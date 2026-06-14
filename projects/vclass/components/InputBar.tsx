"use client";

import { useState, useEffect } from "react";
import type { ConversationStatus, GrammarFlagged } from "@/lib/useConversation";
import ExplainModal from "./ExplainModal";

interface Props {
  status: ConversationStatus;
  pendingTranscript: string;
  grammarFlagged: GrammarFlagged | null;
  onSendText: (text: string) => void;
  onResend: () => void;
  onClearFlag: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranscriptChange: (v: string) => void;
}

export default function InputBar({
  status, pendingTranscript, grammarFlagged,
  onSendText, onResend, onClearFlag, onStartRecording, onStopRecording, onTranscriptChange,
}: Props) {
  const [text, setText] = useState("");
  const [showExplain, setShowExplain] = useState(false);
  const busy = status === "loading" || status === "playing" || status === "transcribing" || status === "checking";
  const flagged = grammarFlagged !== null;

  useEffect(() => {
    if (pendingTranscript) setText(pendingTranscript);
  }, [pendingTranscript]);

  useEffect(() => {
    if (grammarFlagged) setText(grammarFlagged.text);
    else setShowExplain(false);
  }, [grammarFlagged]);

  const handleSubmit = () => {
    if (!text.trim() || busy || flagged) return;
    onSendText(text.trim());
    setText("");
    onTranscriptChange("");
  };

  return (
    <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
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
          {grammarFlagged!.check.explanation && (
            <button
              onClick={() => setShowExplain(true)}
              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              ? explain
            </button>
          )}
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
