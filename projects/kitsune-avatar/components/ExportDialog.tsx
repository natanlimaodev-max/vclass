"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/useConversation";
import type { ScenarioMeta } from "@/lib/scenarios";
import type { AnkiCard } from "@/app/api/export/anki/route";

interface Props {
  history: ChatMessage[];
  scenario: ScenarioMeta;
  onClose: () => void;  // just close dialog, stay in conversation
  onExit: () => void;   // close dialog + exit conversation
}

function buildCards(history: ChatMessage[]): AnkiCard[] {
  const cards: AnkiCard[] = [];
  let audioIdx = 0;

  const visible = history.filter((m) => m.role !== "system");

  visible.forEach((msg) => {
    if (msg.role === "assistant") {
      const name = `bot_audio_${audioIdx++}.mp3`;
      cards.push({
        front: msg.content,
        back: msg.explainContent ?? "",
        audioBase64: msg.audioBase64,
        audioName: msg.audioBase64 ? name : undefined,
      });
    } else if (msg.role === "user") {
      // Only add user card if grammar has an issue or there's user audio
      const hasGrammarIssue = msg.grammarCheck && !msg.grammarCheck.ok;
      if (hasGrammarIssue || msg.audioBase64) {
        const name = `user_audio_${audioIdx++}.webm`;
        cards.push({
          front: msg.content,
          back: msg.grammarCheck?.explanation ?? "",
          audioBase64: msg.audioBase64,
          audioName: msg.audioBase64 ? name : undefined,
          isUserCard: true,
        });
      }
    }
  });

  return cards;
}

export default function ExportDialog({ history, scenario, onClose, onExit }: Props) {
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");

  const deckName = [
    scenario.label,
    scenario.language.charAt(0).toUpperCase() + scenario.language.slice(1),
    scenario.level,
    new Date().toISOString().slice(0, 10),
  ].join(" · ");

  const handleExport = async () => {
    setState("generating");
    try {
      const cards = buildCards(history);
      const res = await fetch("/api/export/anki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckName, cards }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deckName}.apkg`;
      a.click();
      URL.revokeObjectURL(url);
      setState("done");
    } catch {
      setState("error");
    }
  };

  const visibleCount = history.filter((m) => m.role === "assistant").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[420px] p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-white font-semibold text-base">End conversation</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        <p className="text-zinc-400 text-sm">
          {visibleCount} bot {visibleCount === 1 ? "message" : "messages"} · ready to export
        </p>

        <div className="bg-zinc-800 rounded-xl p-3 text-xs text-zinc-400 font-mono break-all">
          {deckName}.apkg
        </div>

        <p className="text-zinc-500 text-xs">
          Each bot message becomes a card with audio. User messages with grammar issues get correction cards.
        </p>

        {state === "error" && (
          <p className="text-red-400 text-xs">Export failed. Try again.</p>
        )}
        {state === "done" && (
          <p className="text-green-400 text-xs">Downloaded! Import into Anki to start studying.</p>
        )}

        <div className="flex gap-2 mt-1">
          <button
            onClick={handleExport}
            disabled={state === "generating"}
            className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-xl transition-colors"
          >
            {state === "generating" ? "Generating…" : "Export as Anki deck"}
          </button>
          <button
            onClick={onExit}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
