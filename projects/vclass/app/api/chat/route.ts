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

function loadContext(language: string, level: string, scenario: string): string {
  const filePath = path.join(SHARED, "contexts", language, level, `${scenario}.md`);
  const raw = fs.readFileSync(filePath, "utf-8");
  return raw.replace(/^---[\s\S]*?---\n/, "").trim();
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
