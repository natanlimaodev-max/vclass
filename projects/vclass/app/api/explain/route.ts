import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const SHARED = path.resolve(process.cwd(), "../../shared");

const EXPLAIN_PROMPTS: Record<string, string> = {
  japanese: "prompts/japanese/explain.txt",
  english: "prompts/english/explain.txt",
};

export async function POST(req: NextRequest) {
  const { sentence, language } = await req.json() as { sentence: string; language?: string };
  const promptFile = EXPLAIN_PROMPTS[language ?? "japanese"] ?? EXPLAIN_PROMPTS["japanese"];
  // Read on each request so prompt edits take effect without restart
  const template = fs.readFileSync(
    path.join(SHARED, promptFile),
    "utf-8"
  );
  const prompt = template.replace("{sentence}", sentence);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ explanation: data.choices[0].message.content });
}
