"use client";

import { useRef, useState } from "react";
import AvatarCanvas, { AvatarCanvasHandle } from "@/components/AvatarCanvas";
import type { ExpressionName } from "@/lib/AvatarController";

const EXPRESSIONS: ExpressionName[] = [
  "happy", "sad", "surprised", "angry", "relaxed",
];

export default function Home() {
  const avatarRef = useRef<AvatarCanvasHandle>(null);
  const [active, setActive] = useState<ExpressionName | null>(null);

  const applyExpression = (name: ExpressionName) => {
    const ctrl = avatarRef.current?.controller;
    if (!ctrl) return;
    ctrl.resetExpressions();
    ctrl.setExpression(name, 1);
    setActive(name);
  };

  const reset = () => {
    avatarRef.current?.controller?.resetExpressions();
    setActive(null);
  };

  return (
    <main className="flex h-screen bg-zinc-950 text-white">
      <div className="flex-1 relative">
        <AvatarCanvas ref={avatarRef} />
      </div>

      <aside className="w-56 flex flex-col gap-3 p-6 border-l border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
          Expressions
        </p>
        {EXPRESSIONS.map((name) => (
          <button
            key={name}
            onClick={() => applyExpression(name)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              active === name
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {name}
          </button>
        ))}
        <button
          onClick={reset}
          className="mt-auto px-4 py-2 rounded text-sm font-medium bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-700"
        >
          reset
        </button>
      </aside>
    </main>
  );
}
