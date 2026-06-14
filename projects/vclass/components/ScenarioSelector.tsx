"use client";

import { useState } from "react";
import { LANGUAGES, type Language, type Level, type StudyType, type ScenarioMeta } from "@/lib/scenarios";

type Step = "language" | "level" | "type" | "scenario";

interface Props {
  onSelect: (scenario: ScenarioMeta) => void;
}

function OptionList<T>({
  items,
  getKey,
  getLabel,
  onSelect,
}: {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={getKey(item)}
          onClick={() => onSelect(item)}
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 text-zinc-200 text-sm font-medium text-left hover:bg-violet-600 hover:text-white transition-colors"
        >
          {getLabel(item)}
        </button>
      ))}
    </div>
  );
}

export default function ScenarioSelector({ onSelect }: Props) {
  const [step, setStep] = useState<Step>("language");
  const [language, setLanguage] = useState<Language | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [type, setType] = useState<StudyType | null>(null);

  const stepLabels: Record<Step, string> = {
    language: "Select Language",
    level:    "Select Level",
    type:     "Study Type",
    scenario: "Select Scenario",
  };

  const breadcrumb = [
    language?.label,
    level?.label,
    type?.label,
  ].filter(Boolean).join(" › ");

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-80 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-white">VClass</h1>
          {breadcrumb ? (
            <button
              onClick={() => {
                if (step === "scenario") { setStep("type"); setType(null); }
                else if (step === "type")  { setStep("level"); setLevel(null); }
                else if (step === "level") { setStep("language"); setLanguage(null); }
              }}
              className="text-xs text-zinc-400 hover:text-violet-400 mt-1 transition-colors"
            >
              ← {breadcrumb}
            </button>
          ) : (
            <p className="text-sm text-zinc-400 mt-1">Choose how to practice</p>
          )}
        </div>

        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">
            {stepLabels[step]}
          </p>

          {step === "language" && (
            <OptionList
              items={LANGUAGES}
              getKey={(l) => l.id}
              getLabel={(l) => l.label}
              onSelect={(l) => { setLanguage(l); setStep("level"); }}
            />
          )}

          {step === "level" && language && (
            <OptionList
              items={language.levels}
              getKey={(l) => l.id}
              getLabel={(l) => l.label}
              onSelect={(l) => { setLevel(l); setStep("type"); }}
            />
          )}

          {step === "type" && level && (
            <OptionList
              items={level.types}
              getKey={(t) => t.id}
              getLabel={(t) => t.label}
              onSelect={(t) => { setType(t); setStep("scenario"); }}
            />
          )}

          {step === "scenario" && type && (
            <OptionList
              items={type.scenarios}
              getKey={(s) => s.scenario}
              getLabel={(s) => s.label}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </div>
  );
}
