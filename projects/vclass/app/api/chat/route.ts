import { NextResponse } from "next/server";
import type { Message } from "@/lib/types";
import { apiRoute, HttpError, readJson } from "@/lib/server/http";
import { chatCompletion } from "@/lib/server/openrouter";
import { buildSystemPrompt, validateScenario } from "@/lib/server/shared";

const MAX_TURNS = 100;
const MAX_MESSAGE_LENGTH = 4000;

/**
 * Only user/assistant turns are accepted from the browser. The system prompt
 * is rebuilt here on every request, so the client can never replace it.
 */
function parseHistory(value: unknown): Message[] {
  if (!Array.isArray(value)) throw new HttpError("'history' must be an array", 400);
  if (value.length > MAX_TURNS) throw new HttpError("Conversation is too long", 400);
  return value.map((m) => {
    const { role, content } = (m ?? {}) as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      throw new HttpError("Invalid message in history", 400);
    }
    if (content.length > MAX_MESSAGE_LENGTH) throw new HttpError("Message is too long", 400);
    return { role, content };
  });
}

export const POST = apiRoute(async (req) => {
  const body = await readJson(req);
  const scenario = validateScenario(body);
  const history = parseHistory(body.history);

  const content = await chatCompletion([
    { role: "system", content: buildSystemPrompt(scenario) },
    ...history,
  ]);
  return NextResponse.json({ content });
});
