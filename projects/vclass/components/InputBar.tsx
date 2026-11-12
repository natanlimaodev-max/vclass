"use client";

import { useState } from "react";
import type { ConversationStatus, GrammarFlagged } from "@/lib/useConversation";
import ExplainModal from "./ExplainModal";

interface Props {
  status: ConversationStatus;
  pendingTranscript: string;
  grammarFlagged: GrammarFlagged | null;
  error: string | null;
  onRetry: () => void;
  onDismissError: () => void;
  onSendText: (text: string) => void;
  onResend: () => void;
  onClearFlag: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranscriptChange: (v: string) => void;
}

export default function InputBar({
  status, pendingTranscript, grammarFlagged, error, onRetry, onDismissError,
  onSendText, onResend, onClearFlag, onStartRecording, onStopRecording, onTranscriptChange,
}: Props) {
  const [text, setText] = useState("");
  const [showExplain, setShowExplain] = useState(false);
  const busy = status === "loading" || status === "playing" || status === "transcribing" || status === "checking";
  const flagged = grammarFlagged !== null;

  // Sync the input with new transcripts / flagged messages when those props change
  // (render-time adjustment instead of setState inside an effect).
  const [prevTranscript, setPrevTranscript] = useState(pendingTranscript);
  if (pendingTranscript !== prevTranscript) {
    setPrevTranscript(pendingTranscript);
    if (pendingTranscript) setText(pendingTranscript);
  }

  const [prevFlagged, setPrevFlagged] = useState(grammarFlagged);
  if (grammarFlagged !== prevFlagged) {
    setPrevFlagged(grammarFlagged);
    if (grammarFlagged) setText(grammarFlagged.text);
    else setShowExplain(false);
  }

  const handleSubmit = () => {
    if (!text.trim() || busy || flagged) return;
    onSendText(text.trim());
    setText("");
    onTranscriptChange("");
  };

  return (
    <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl bg-red-950/60 border border-red-700/60 px-3 py-2">
          <p className="text-xs text-red-300 flex-1">{error}</p>
          <div className="flex gap-3 shrink-0">
            <button onClick={onRetry} className="text-xs text-red-200 hover:text-white transition-colors">
              Retry
            </button>
            <button onClick={onDismissError} aria-label="Dismiss error" className="text-xs text-red-400 hover:text-red-200 transition-colors">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); onTranscriptChange(e.target.value); }}
          onFocus={() => { if (flagged) onClearFlag(); }}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Type your response..."
          disabled={busy}
          className={`flex-1 text-zinc-100 placeholder-zinc-500 px-4 py-2 rounded-xl text-sm outline-none transition-colors
            ${flagged
              ? "bg-amber-950/60 border border-amber-600/60 text-amber-200"
              : "bg-zinc-800 focus:ring-1 focus:ring-violet-500 disabled:opacity-40"
            }`}
        />
        <button
          onClick={handleSubmit}
          disabled={busy || !text.trim() || flagged}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-violet-500 transition-colors"
        >
          Send
        </button>
      </div>

      {status === "recording" ? (
        <button
          onClick={onStopRecording}
          className="w-full py-2 rounded-xl bg-red-600 text-white text-sm font-medium animate-pulse"
        >
          ⏹ Stop Recording
        </button>
      ) : (
        <button
          onClick={onStartRecording}
          disabled={busy}
          className="w-full py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          🎤 Speak
        </button>
      )}

      {status === "checking"     && <p className="text-xs text-amber-500 text-center animate-pulse">checking grammar...</p>}
      {status === "loading"      && <p className="text-xs text-zinc-500 text-center animate-pulse">thinking...</p>}
      {status === "playing"      && <p className="text-xs text-zinc-500 text-center animate-pulse">speaking...</p>}
      {status === "transcribing" && <p className="text-xs text-zinc-500 text-center animate-pulse">transcribing...</p>}

      {flagged && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-500">Grammar issue found — speak or edit to correct</p>
          <div className="flex gap-3 shrink-0">
            {grammarFlagged!.check.explanation && (
              <button
                onClick={() => setShowExplain(true)}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                ? explain
              </button>
            )}
            <button
              onClick={onResend}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Send as is; the correction is kept for the Anki export"
            >
              send anyway
            </button>
          </div>
        </div>
      )}

      {showExplain && grammarFlagged && (
        <ExplainModal
          sentence={grammarFlagged.text}
          content={grammarFlagged.check.explanation ?? undefined}
          onClose={() => setShowExplain(false)}
        />
      )}
    </div>
  );
}
