"use client";

import { useRef, useState, useEffect } from "react";
import AvatarCanvas, { AvatarCanvasHandle } from "@/components/AvatarCanvas";
import ScenarioSelector from "@/components/ScenarioSelector";
import ChatPanel from "@/components/ChatPanel";
import InputBar from "@/components/InputBar";
import { useConversation } from "@/lib/useConversation";
import type { ScenarioMeta } from "@/lib/scenarios";

function ConversationPanel({ scenario, onExit }: { scenario: ScenarioMeta; onExit: () => void }) {
  const {
    history, status, pendingTranscript,
    start, sendMessage, replayAudio,
    startRecording, stopRecording, setPendingTranscript,
  } = useConversation(scenario);

  useEffect(() => { start(); }, []); // eslint-disable-line

  return (
    <aside className="w-96 flex flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <div>
          <p className="text-sm font-medium text-white">{scenario.label}</p>
          <p className="text-xs text-zinc-500">{scenario.language} · {scenario.level}</p>
        </div>
        <button onClick={onExit} className="text-xs text-zinc-500 hover:text-zinc-300 ml-4">
          Exit
        </button>
      </div>

      <ChatPanel history={history} onReplay={replayAudio} />

      <InputBar
        status={status}
        pendingTranscript={pendingTranscript}
        onSendText={sendMessage}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onTranscriptChange={setPendingTranscript}
      />
    </aside>
  );
}

export default function Home() {
  const avatarRef = useRef<AvatarCanvasHandle>(null);
  const [scenario, setScenario] = useState<ScenarioMeta | null>(null);

  return (
    <main className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <div className="flex-1 relative">
        <AvatarCanvas ref={avatarRef} />
        {!scenario && <ScenarioSelector onSelect={setScenario} />}
      </div>

      {scenario && (
        <ConversationPanel
          scenario={scenario}
          onExit={() => setScenario(null)}
        />
      )}
    </main>
  );
}
