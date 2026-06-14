import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// Paths relative to monorepo root (two levels up from projects/kitsune-avatar)
const SHARED = path.resolve(process.cwd(), "../../shared");

const FURIGANA_INSTRUCTION = fs.readFileSync(
  path.join(SHARED, "prompts/japanese/furigana.txt"),
  "utf-8"
);

function loadLevelConstraints(language: string, level: string): string {
  const langPath = path.join(SHARED, "languages", `${language}.json`);
  if (!fs.existsSync(langPath)) return "";
  const lang = JSON.parse(fs.readFileSync(langPath, "utf-8"));
  const lvl = (lang.levels as Array<{ code: string; grammar_notes?: string }>)
    ?.find((l) => l.code === level);
  return lvl?.grammar_notes
    ? `## Language Constraints (${level})\n${lvl.grammar_notes}`
    : "";
}

function loadContext(language: string, level: string, scenario: string): string {
  const flatPath = path.join(SHARED, "contexts", language, `${scenario}.md`);
  const nestedPath = path.join(SHARED, "contexts", language, level, `${scenario}.md`);
  const filePath = fs.existsSync(flatPath) ? flatPath : nestedPath;
  const raw = fs.readFileSync(filePath, "utf-8");
  const content = raw.replace(/^---[\s\S]*?---\n/, "").trim();
  const constraints = loadLevelConstraints(language, level);
  return constraints ? `${content}\n\n${constraints}` : content;
}

export async function POST(req: NextRequest) {
  const { history, language, level, scenario } = await req.json() as {
    history: Message[];
    language?: string;
    level?: string;
    scenario?: string;
  };

  let messages: Message[] = history;

  // First message — build system prompt from .md + furigana rules
  if (history.length === 0 && language && level && scenario) {
    const context = loadContext(language, level, scenario);
    const furigana = language === "japanese" ? FURIGANA_INSTRUCTION : "";
    messages = [{ role: "system", content: `${context}\n${furigana}` }];
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const content: string = data.choices[0].message.content;

  return NextResponse.json({ content, messages });
}
