"use client";

import { useRef, useState, useEffect } from "react";
import AvatarCanvas, { AvatarCanvasHandle } from "@/components/AvatarCanvas";
import ScenarioSelector from "@/components/ScenarioSelector";
import ChatPanel from "@/components/ChatPanel";
import InputBar from "@/components/InputBar";
import ExportDialog from "@/components/ExportDialog";
import { useConversation } from "@/lib/useConversation";
import type { ScenarioMeta } from "@/lib/scenarios";
import type { AvatarController } from "@/lib/AvatarController";

const MIN_WIDTH = 280;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 384; // w-96

function ConversationPanel({
  scenario, controller, width, onExit,
}: {
  scenario: ScenarioMeta;
  controller: AvatarController | null;
  width: number;
  onExit: () => void;
}) {
  const {
    history, status, pendingTranscript, grammarFlagged,
    start, sendMessage, sendFlagged, clearGrammarFlagged, replayAudio,
    startRecording, stopRecording, setPendingTranscript,
  } = useConversation(scenario, controller);

  const [showExport, setShowExport] = useState(false);

  useEffect(() => { start(); }, []); // eslint-disable-line

  return (
    <aside style={{ width }} className="flex flex-col border-l border-zinc-800 bg-zinc-950 shrink-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <div>
          <p className="text-sm font-medium text-white">{scenario.label}</p>
          <p className="text-xs text-zinc-500">{scenario.language} · {scenario.level}</p>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <button
            onClick={() => setShowExport(true)}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            End
          </button>
          <button onClick={onExit} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Exit
          </button>
        </div>
      </div>

      <ChatPanel history={history} onReplay={replayAudio} />

      <InputBar
        status={status}
        pendingTranscript={pendingTranscript}
        grammarFlagged={grammarFlagged}
        onSendText={sendMessage}
        onResend={sendFlagged}
        onClearFlag={clearGrammarFlagged}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onTranscriptChange={setPendingTranscript}
      />

      {showExport && (
        <ExportDialog
          history={history}
          scenario={scenario}
          onClose={() => setShowExport(false)}
          onExit={() => { setShowExport(false); onExit(); }}
        />
      )}
    </aside>
  );
}

export default function Home() {
  const avatarRef = useRef<AvatarCanvasHandle>(null);
  const [scenario, setScenario] = useState<ScenarioMeta | null>(null);
  const [controller, setController] = useState<AvatarController | null>(null);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
  const panelWidthRef = useRef(DEFAULT_WIDTH);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    const interval = setInterval(() => {
      const ctrl = avatarRef.current?.controller ?? null;
      if (ctrl) { setController(ctrl); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const originX = e.clientX;
    const originWidth = panelWidthRef.current;

    const onMove = (ev: PointerEvent) => {
      const delta = originX - ev.clientX;
      setPanelWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, originWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <main className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      <div className="flex-1 relative min-w-0 overflow-hidden">
        <AvatarCanvas ref={avatarRef} />
        {!scenario && <ScenarioSelector onSelect={setScenario} />}
      </div>

      {scenario && (
        <>
          {/* Drag handle */}
          <div
            onPointerDown={onPointerDown}
            className="w-1 cursor-col-resize bg-zinc-800 hover:bg-violet-500 active:bg-violet-400 transition-colors shrink-0 select-none relative z-10"
          />
          <ConversationPanel
            scenario={scenario}
            controller={controller}
            width={panelWidth}
            onExit={() => setScenario(null)}
          />
        </>
      )}
    </main>
  );
}
