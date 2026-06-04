"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/app/api/chat/route";
import { renderFurigana } from "@/lib/furigana";

interface Props {
  history: Message[];
}

export default function ChatPanel({ history }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visible = history.filter((m) => m.role !== "system");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {visible.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm leading-loose ${
              msg.role === "user"
                ? "bg-violet-600 text-white rounded-br-sm"
                : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
            }`}
          >
            {msg.role === "assistant"
              ? renderFurigana(msg.content)
              : msg.content}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
