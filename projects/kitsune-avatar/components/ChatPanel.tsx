"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/useConversation";
import { renderFurigana } from "@/lib/furigana";
import ExplainModal from "./ExplainModal";

interface Props {
  history: ChatMessage[];
  onReplay: (text: string) => void;
}

export default function ChatPanel({ history, onReplay }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [explaining, setExplaining] = useState<string | null>(null);
  const visible = history.filter((m) => m.role !== "system");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  // Strip furigana brackets for explain prompt
  const stripFurigana = (text: string) => text.replace(/\s*\[[^\]]+\]/g, "");

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {visible.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex flex-col gap-1 max-w-[80%]">
              <div
                className={`px-4 py-2 rounded-2xl text-sm chat-bubble ${
                  msg.role === "user"
                    ? "bg-violet-600 text-white rounded-br-sm"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? renderFurigana(msg.content) : msg.content}
              </div>
              {msg.role === "assistant" && (
                <div className="flex gap-3 px-1">
                  <button
                    onClick={() => onReplay(msg.content)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    ▶ replay
                  </button>
                  <button
                    onClick={() => setExplaining(stripFurigana(msg.content))}
                    className="text-xs text-zinc-500 hover:text-violet-400 transition-colors"
                  >
                    ? explain
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {explaining && (
        <ExplainModal sentence={explaining} onClose={() => setExplaining(null)} />
      )}
    </>
  );
}
