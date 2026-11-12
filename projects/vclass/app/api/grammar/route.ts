import { NextResponse } from "next/server";
import { apiRoute, readJson, requireText } from "@/lib/server/http";
import { chatCompletion } from "@/lib/server/openrouter";
import { assertLanguage, renderPrompt } from "@/lib/server/shared";

/** Pull the first {...} block out of a reply, tolerating ```json fences or extra prose. */
function extractJson(raw: string): { ok?: unknown; explanation?: unknown } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const POST = apiRoute(async (req) => {
  const body = await readJson(req);
  const sentence = requireText(body.sentence, "sentence", 2000);
  const language = assertLanguage(body.language);

  const prompt = renderPrompt(language, "grammar", sentence);
  if (!prompt) return NextResponse.json({ ok: true, explanation: null, checked: false });

  const raw = await chatCompletion([{ role: "user", content: prompt }]);
  const parsed = extractJson(raw);
  if (!parsed) {
    // Fail open so the conversation is never blocked, but tell the client the check didn't run.
    console.warn("Grammar check returned non-JSON:", raw.slice(0, 200));
    return NextResponse.json({ ok: true, explanation: null, checked: false });
  }
  return NextResponse.json({
    ok: Boolean(parsed.ok),
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : null,
    checked: true,
  });
});
