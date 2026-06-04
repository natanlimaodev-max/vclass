"use client";

import { useState, useRef, useCallback } from "react";
import type { ScenarioMeta } from "./scenarios";
import type { Message } from "@/app/api/chat/route";

export type ConversationStatus = "idle" | "loading" | "playing" | "recording";

export function useConversation(scenario: ScenarioMeta) {
  const [history, setHistory] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(false);   // first-turn guard (sendMessage)
  const initiatedRef = useRef(false); // strict-mode double-effect guard

  const playAudio = useCallback(async (text: string) => {
    setStatus("playing");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { setStatus("idle"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play();
    });
    setStatus("idle");
  }, []);

  const sendMessage = useCallback(async (userText?: string) => {
    setStatus("loading");

    const userMsg: Message = userText
      ? { role: "user", content: userText }
      : { role: "system", content: "" }; // placeholder for first turn

    let messages: Message[];

    if (!startedRef.current) {
      // First turn — no user message, just load context
      startedRef.current = true;
      messages = [];
    } else {
      messages = [...history, { role: "user", content: userText! }];
      setHistory(messages);
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: messages,
        language: scenario.language,
        level: scenario.level,
        scenario: scenario.scenario,
      }),
    });

    if (!res.ok) { setStatus("idle"); return; }

    const data = await res.json();
    const assistantMsg: Message = { role: "assistant", content: data.content };
    const fullHistory: Message[] = [...data.messages, assistantMsg];
    setHistory(fullHistory);

    await playAudio(data.content);
  }, [history, scenario, playAudio]);

  const start = useCallback(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    startedRef.current = false;
    setHistory([]);
    sendMessage();
  }, [sendMessage]);

  const retry = useCallback(() => {
    // Remove last user message and re-send
    const trimmed = history.slice(0, -2);
    setHistory(trimmed);
    sendMessage(history.at(-2)?.content);
  }, [history, sendMessage]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("audio", blob);
      setStatus("loading");
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) { setStatus("idle"); return; }
      const { transcript } = await res.json();
      if (transcript) await sendMessage(transcript);
      else setStatus("idle");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  return { history, status, start, sendMessage, retry, startRecording, stopRecording };
}
