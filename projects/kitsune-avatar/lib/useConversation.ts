"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ScenarioMeta } from "./scenarios";
import type { Message } from "@/app/api/chat/route";

export type ConversationStatus = "idle" | "loading" | "playing" | "recording" | "transcribing";

export interface ChatMessage extends Message {
  audioUrl?: string;
}

export function useConversation(scenario: ScenarioMeta) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [pendingTranscript, setPendingTranscript] = useState("");

  const historyRef = useRef<ChatMessage[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const initiatedRef = useRef(false);
  const firstTurnRef = useRef(true);

  const playAudio = useCallback(async (text: string): Promise<string | null> => {
    setStatus("playing");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { setStatus("idle"); return null; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play();
    });
    setStatus("idle");
    return url;
  }, []);

  const replayAudio = useCallback(async (text: string) => {
    await playAudio(text);
  }, [playAudio]);

  const sendMessage = useCallback(async (userText?: string) => {
    setStatus("loading");
    setPendingTranscript("");

    const current = historyRef.current;
    let messages: ChatMessage[];

    if (firstTurnRef.current) {
      firstTurnRef.current = false;
      messages = [];
    } else {
      const userMsg: ChatMessage = { role: "user", content: userText! };
      messages = [...current, userMsg];
      setHistory(messages);
    }

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: messages.map(({ audioUrl: _, ...m }) => m),
        language: scenario.language,
        level: scenario.level,
        scenario: scenario.scenario,
      }),
    });

    if (!res.ok) { setStatus("idle"); return; }

    const data = await res.json();

    // 1. Show text immediately
    const assistantMsg: ChatMessage = { role: "assistant", content: data.content };
    const systemMsg = data.messages[0] as ChatMessage | undefined;
    const prior = historyRef.current.filter(m => m.role !== "system");
    const full: ChatMessage[] = [
      ...(systemMsg ? [systemMsg] : []),
      ...prior.filter(m => m.role === "user" || m.role === "assistant"),
      assistantMsg,
    ];
    setHistory(full);

    // 2. Play audio after text is visible
    const audioUrl = await playAudio(data.content);

    // 3. Update message with audioUrl for replay
    if (audioUrl) {
      setHistory(prev =>
        prev.map((m, i) => i === prev.length - 1 ? { ...m, audioUrl } : m)
      );
    }
  }, [scenario, playAudio]);

  const start = useCallback(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    firstTurnRef.current = true;
    setHistory([]);
    sendMessage();
  }, [sendMessage]);

  const retry = useCallback(async () => {
    const current = historyRef.current;
    let lastUserIdx = -1;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const userText = current[lastUserIdx].content;
    setHistory(current.slice(0, lastUserIdx));
    await sendMessage(userText);
  }, [sendMessage]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("transcribing");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("model_id", "scribe_v1");
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) {
        console.error("STT error:", await res.json().catch(() => ({})));
        setStatus("idle");
        return;
      }
      const { transcript } = await res.json();
      if (transcript?.trim()) {
        setPendingTranscript(transcript.trim()); // put in input — user confirms
      }
      setStatus("idle");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  return {
    history, status, pendingTranscript,
    start, sendMessage, retry, replayAudio,
    startRecording, stopRecording,
    setPendingTranscript,
  };
}
