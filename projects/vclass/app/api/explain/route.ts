import { NextResponse } from "next/server";
import { apiRoute, HttpError, readJson, requireText } from "@/lib/server/http";
import { chatCompletion } from "@/lib/server/openrouter";
import { assertLanguage, renderPrompt } from "@/lib/server/shared";

export const POST = apiRoute(async (req) => {
  const body = await readJson(req);
  const sentence = requireText(body.sentence, "sentence", 2000);
  const language = assertLanguage(body.language ?? "japanese");

  const prompt = renderPrompt(language, "explain", sentence);
  if (!prompt) throw new HttpError(`No explain prompt for ${language}`, 400);

  const explanation = await chatCompletion([{ role: "user", content: prompt }]);
  return NextResponse.json({ explanation });
});
