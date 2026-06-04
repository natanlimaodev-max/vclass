"use client";

import { useState } from "react";
import type { ConversationStatus } from "@/lib/useConversation";

interface Props {
  status: ConversationStatus;
  onSendText: (text: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onRetry: () => void;
}

export default function InputBar({
  status,
  onSendText,
  onStartRecording,
  onStopRecording,
  onRetry,
}: Props) {
  const [text, setText] = useState("");
  const busy = status === "loading" || status === "playing";

  const handleSubmit = () => {
    if (!text.trim() || busy) return;
    onSendText(text.trim());
    setText("");
  };

  return (
    <div className="border-t border-zinc-800 p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Type your response..."
          disabled={busy}
          className="flex-1 bg-zinc-800 text-zinc-100 placeholder-zinc-500 px-4 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-40"
        />
        <button
          onClick={handleSubmit}
          disabled={busy || !text.trim()}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-violet-500 transition-colors"
        >
          Send
        </button>
      </div>

      <div className="flex gap-2">
        {status === "recording" ? (
          <button
            onClick={onStopRecording}
            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium animate-pulse"
          >
            ⏹ Stop Recording
          </button>
        ) : (
          <button
            onClick={onStartRecording}
            disabled={busy}
            className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            🎤 Speak
          </button>
        )}
        <button
          onClick={onRetry}
          disabled={busy || status === "recording"}
          className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          Retry
        </button>
      </div>

      {status === "loading" && (
        <p className="text-xs text-zinc-500 text-center animate-pulse">thinking...</p>
      )}
      {status === "playing" && (
        <p className="text-xs text-zinc-500 text-center animate-pulse">speaking...</p>
      )}
    </div>
  );
}
