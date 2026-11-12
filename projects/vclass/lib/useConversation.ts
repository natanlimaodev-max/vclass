"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ScenarioMeta } from "./scenarios";
import type { Message } from "./types";
import type { AvatarController } from "./AvatarController";
import { playWithLipSync } from "./lipSync";
import { stripFurigana } from "./text";

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

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** POST JSON and return the parsed body, throwing an Error with the server's message on failure. */
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

export function useConversation(
  scenario: ScenarioMeta,
  controller: AvatarController | null = null
) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("idle");
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [grammarFlagged, setGrammarFlagged] = useState<GrammarFlagged | null>(null);
  const [error, setError] = useState<string | null>(null);

  const historyRef = useRef<ChatMessage[]>([]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const controllerRef = useRef<AvatarController | null>(controller);
  useEffect(() => { controllerRef.current = controller; }, [controller]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const initiatedRef = useRef(false);
  const pendingUserAudioRef = useRef<string | null>(null);

  const playAudio = useCallback(async (text: string): Promise<{ url: string; base64: string } | null> => {
    setStatus("playing");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Could not generate audio");
      }
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
          audio.play().catch(() => resolve());
        });
      }
      return { url, base64 };
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setStatus("idle");
    }
  }, []);

  const replayAudio = useCallback(async (text: string) => {
    await playAudio(text);
  }, [playAudio]);

  /**
   * Ask the LLM for the next assistant turn given the conversation so far,
   * then fetch the explanation and play the audio in parallel.
   */
  const assistantTurn = useCallback(async (messages: ChatMessage[]) => {
    setStatus("loading");
    setError(null);
    try {
      const { content } = await postJSON<{ content: string }>("/api/chat", {
        history: messages.map(({ role, content }) => ({ role, content })),
        language: scenario.language,
        level: scenario.level,
        scenario: scenario.scenario,
      });
      setHistory([...messages, { role: "assistant", content }]);

      const explainPromise = postJSON<{ explanation: string }>("/api/explain", {
        sentence: stripFurigana(content),
        language: scenario.language,
      })
        .then((d) => d.explanation)
        .catch(() => null);

      const audioResult = await playAudio(content);
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
    } catch (err) {
      setError(errorMessage(err));
      setStatus("idle");
    }
  }, [scenario, playAudio]);

  // Core LLM submission — called after grammar is resolved
  const submitToLLM = useCallback(async (
    userText: string,
    grammarCheck: GrammarCheck,
    flagged: boolean,
    audioBase64?: string,
  ) => {
    setPendingTranscript("");
    const userMsg: ChatMessage = { role: "user", content: userText, audioBase64, grammarCheck, flagged };
    const messages = [...historyRef.current, userMsg];
    setHistory(messages);
    await assistantTurn(messages);
  }, [assistantTurn]);

  // Send message — grammar check first, then LLM or flag
  const sendMessage = useCallback(async (userText: string) => {
    if (!userText) return;

    // Consume pending user audio
    const audioBase64 = pendingUserAudioRef.current ?? undefined;
    pendingUserAudioRef.current = null;

    setStatus("checking");
    setError(null);
    let grammarCheck: GrammarCheck;
    try {
      grammarCheck = await postJSON<GrammarCheck>("/api/grammar", {
        sentence: userText,
        language: scenario.language,
      });
    } catch {
      // If the check itself fails, don't block the conversation.
      grammarCheck = { ok: true, explanation: null };
    }

    if (grammarCheck.ok) {
      await submitToLLM(userText, grammarCheck, false, audioBase64);
    } else {
      setGrammarFlagged({ text: userText, check: grammarCheck, audioBase64 });
      setStatus("idle");
    }
  }, [scenario, submitToLLM]);

  // Resend a flagged message — skips grammar, marks as flagged
  const sendFlagged = useCallback(async () => {
    if (!grammarFlagged) return;
    const { text, check, audioBase64 } = grammarFlagged;
    setGrammarFlagged(null);
    await submitToLLM(text, check, true, audioBase64);
  }, [grammarFlagged, submitToLLM]);

  // First bot turn — the assistant opens the conversation
  const start = useCallback(() => {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    setHistory([]);
    assistantTurn([]);
  }, [assistantTurn]);

  /** Retry after an error: re-run the last turn that didn't get an answer. */
  const retry = useCallback(async () => {
    const current = historyRef.current;
    const last = current[current.length - 1];
    if (!last || last.role === "user") {
      await assistantTurn(current);
    } else {
      setError(null);
    }
  }, [assistantTurn]);

  const startRecording = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was denied or is unavailable");
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("transcribing");
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobToBase64(blob).then((b64) => { pendingUserAudioRef.current = b64; }).catch(() => {});
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        form.append("language", scenario.language);
        const res = await fetch("/api/stt", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Transcription failed");
        const transcript = (data.transcript as string | undefined)?.trim();
        if (transcript) {
          setGrammarFlagged(null); // clear old flag — new attempt incoming
          setPendingTranscript(transcript);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setStatus("idle");
      }
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
  const dismissError = useCallback(() => setError(null), []);

  return {
    history, status, pendingTranscript, grammarFlagged, error,
    start, sendMessage, sendFlagged, clearGrammarFlagged, retry, replayAudio, dismissError,
    startRecording, stopRecording, setPendingTranscript,
  };
}
