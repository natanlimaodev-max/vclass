"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface Props {
  sentence: string;
  onClose: () => void;
}

export default function ExplainModal({ sentence, onClose }: Props) {
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence }),
    })
      .then((r) => r.json())
      .then((d) => setExplanation(d.explanation ?? d.error ?? "Error"))
      .catch(() => setExplanation("Failed to load explanation."))
      .finally(() => setLoading(false));
  }, [sentence]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[50vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-800">
          <p className="text-sm text-zinc-400 leading-relaxed flex-1 pr-4">{sentence}</p>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 text-lg leading-none mt-0.5"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {loading ? (
            <p className="text-zinc-500 text-sm animate-pulse">Loading explanation...</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none
              [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white
              [&_strong]:text-white
              [&_p]:text-zinc-300 [&_p]:leading-relaxed
              [&_li]:text-zinc-300 [&_li]:leading-relaxed
              [&_ul]:space-y-1 [&_ol]:space-y-1
              [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:mt-4 [&_h3]:mb-1">
              <ReactMarkdown>{explanation}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
