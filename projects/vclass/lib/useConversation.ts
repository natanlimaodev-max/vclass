"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ScenarioMeta } from "./scenarios";
import type { Message } from "@/app/api/chat/route";
import type { AvatarController } from "./AvatarController";
import { playWithLipSync } from "./lipSync";

export type ConversationStatus =
  | "idle" | "checking" | "loading" | "playing" | "recording" | "transcribing";

export interface GrammarCheck {
  ok: boolean;
  explanation: string | null;
}

export interface GrammarFlagged {
  text: string;
  check: GrammarCheck;
  audioBase64?: string;
}

export interface ChatMessage extends Message {
  audioUrl?: string;
  audioBase64?: string;
  explainContent?: string;
  grammarCheck?: GrammarCheck;
  flagged?: boolean;   // sent despite grammar warning
}

const stripFurigana = (text: string) => text.replace(/\s*\[[^\]]+\]/g, "");

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function useConversation(
  scenario: ScenarioMeta,
  controller: AvatarController | null = null
) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [grammarFlagged, setGrammarFlagged] = useState<GrammarFlagged | null>(null);

  const historyRef = useRef<ChatMessage[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const controllerRef = useRef<AvatarController | null>(controller);
  useEffect(() => { controllerRef.current = controller; }, [controller]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const initiatedRef = useRef(false);
  const firstTurnRef = useRef(true);
  const pendingUserAudioRef = useRef<string | null>(null);

  const playAudio = useCallback(async (text: string): Promise<{ url: string; base64: string } | null> => {
    setStatus("playing");
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) { setStatus("idle"); return null; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const base64 = await blobToBase64(blob);

    const ctrl = controllerRef.current;
    if (ctrl) {
      await playWithLipSync(blob, (v) => ctrl.setMouth(v));
    } else {
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play();
      });
    }

    setStatus("idle");
    return { url, base64 };
  }, []);

  const replayAudio = useCallback(async (text: string) => {
    await playAudio(text);
  }, [playAudio]);

  // Core LLM submission — called after grammar is resolved
  const submitToLLM = useCallback(async (
    userText: string,
    grammarCheck: GrammarCheck,
    flagged: boolean,
    audioBase64?: string,
  ) => {
    setStatus("loading");
    setPendingTranscript("");

    const current = historyRef.current;
    const userMsg: ChatMessage = {
      role: "user",
      content: userText,
      audioBase64,
      grammarCheck,
      flagged,
    };
    const messages = [...current, userMsg];
    setHistory(messages);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: messages.map(({ audioUrl: _, audioBase64: __, explainContent: ___, grammarCheck: ____, flagged: _____, ...m }) => m),
        language: scenario.language,
        level: scenario.level,
        scenario: scenario.scenario,
      }),
    });

    if (!res.ok) { setStatus("idle"); return; }

    const data = await res.json();
    const assistantMsg: ChatMessage = { role: "assistant", content: data.content };
    const systemMsg = data.messages[0] as ChatMessage | undefined;
    const prior = historyRef.current.filter(m => m.role !== "system");
    const full: ChatMessage[] = [
      ...(systemMsg ? [systemMsg] : []),
      ...prior.filter(m => m.role === "user" || m.role === "assistant"),
      assistantMsg,
    ];
    setHistory(full);

    // Explain runs in parallel with audio
    const explainPromise = fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence: stripFurigana(data.content) }),
    })
      .then((r) => r.json())
      .then((d) => (d.explanation as string) ?? null)
      .catch(() => null);

    const audioResult = await playAudio(data.content);
    const explainContent = await explainPromise;

    setHistory((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1
          ? {
              ...m,
              audioUrl: audioResult?.url ?? m.audioUrl,
              audioBase64: audioResult?.base64 ?? m.audioBase64,
              explainContent: explainContent ?? m.explainContent,
            }
          : m
      )
    );
  }, [scenario, playAudio]);

  // Send message — grammar check first, then LLM or flag
  const sendMessage = useCallback(async (userText?: string) => {
    // First bot turn — no user text, skip grammar
    if (firstTurnRef.current) {
      firstTurnRef.current = false;
      setStatus("loading");
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [],
          language: scenario.language,
          level: scenario.level,
          scenario: scenario.scenario,
        }),
      });
      if (!res.ok) { setStatus("idle"); return; }
      const data = await res.json();
      const assistantMsg: ChatMessage = { role: "assistant", content: data.content };
      const systemMsg = data.messages[0] as ChatMessage | undefined;
      setHistory([...(systemMsg ? [systemMsg] : []), assistantMsg]);
      const explainPromise = fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: stripFurigana(data.content) }),
      }).then(r => r.json()).then(d => (d.explanation as string) ?? null).catch(() => null);
      const audioResult = await playAudio(data.content);
      const explainContent = await explainPromise;
      setHistory(prev => prev.map((m, i) =>
        i === prev.length - 1
          ? { ...m, audioUrl: audioResult?.url, audioBase64: audioResult?.base64, explainContent: explainContent ?? undefined }
          : m
      ));
      return;
    }

    if (!userText) return;

    // Consume pending user audio
    const audioBase64 = pendingUserAudioRef.current ?? undefined;
    pendingUserAudioRef.current = null;

    // Grammar check FIRST
    setStatus("checking");
    try {
      const grammarCheck: GrammarCheck = await fetch("/api/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentence: userText, language: scenario.language }),
      }).then(r => r.json());

      if (grammarCheck.ok) {
        await submitToLLM(userText, grammarCheck, false, audioBase64);
      } else {
        setGrammarFlagged({ text: userText, check: grammarCheck, audioBase64 });
        setStatus("idle");
      }
    } catch {
      // On error, send anyway
      await submitToLLM(userText, { ok: true, explanation: null }, false, audioBase64);
    }
  }, [scenario, submitToLLM, playAudio]);

  // Resend a flagged message — skips grammar, marks as flagged
  const sendFlagged = useCallback(async () => {
    if (!grammarFlagged) return;
    const { text, check, audioBase64 } = grammarFlagged;
    setGrammarFlagged(null);
    await submitToLLM(text, check, true, audioBase64);
  }, [grammarFlagged, submitToLLM]);

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
    const { content, grammarCheck, audioBase64 } = current[lastUserIdx];
    setHistory(current.slice(0, lastUserIdx));
    await submitToLLM(content, grammarCheck ?? { ok: true, explanation: null }, false, audioBase64);
  }, [submitToLLM]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("transcribing");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      blobToBase64(blob).then((b64) => { pendingUserAudioRef.current = b64; }).catch(() => {});
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("model_id", "scribe_v1");
      form.append("language", scenario.language);
      const res = await fetch("/api/stt", { method: "POST", body: form });
      if (!res.ok) {
        console.error("STT error:", await res.json().catch(() => ({})));
        setStatus("idle");
        return;
      }
      const { transcript } = await res.json();
      if (transcript?.trim()) {
        setGrammarFlagged(null); // clear old flag — new attempt incoming
        setPendingTranscript(transcript.trim());
      }
      setStatus("idle");
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setStatus("recording");
  }, [scenario.language]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }, []);

  const clearGrammarFlagged = useCallback(() => setGrammarFlagged(null), []);

  return {
    history, status, pendingTranscript, grammarFlagged,
    start, sendMessage, sendFlagged, clearGrammarFlagged, retry, replayAudio,
    startRecording, stopRecording, setPendingTranscript,
  };
}
