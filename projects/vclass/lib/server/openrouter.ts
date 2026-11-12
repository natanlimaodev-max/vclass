export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

const DEFAULT_MODEL = "openai/gpt-4o-mini";
const TIMEOUT_MS = 60_000;

/** Call OpenRouter chat completions and return the first choice's text. Throws UpstreamError. */
export async function chatCompletion(
  messages: LLMMessage[],
  options: { temperature?: number } = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new UpstreamError("OPENROUTER_API_KEY is not configured", 500);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL, messages, ...options }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("OpenRouter request failed:", err);
    throw new UpstreamError("Could not reach the language model");
  }

  if (!res.ok) {
    console.error("OpenRouter error:", res.status, await res.text().catch(() => ""));
    throw new UpstreamError(`Language model error (${res.status})`, res.status === 429 ? 429 : 502);
  }

  const data = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    console.error("OpenRouter returned no content:", JSON.stringify(data)?.slice(0, 500));
    throw new UpstreamError(data?.error?.message ?? "Language model returned an empty answer");
  }
  return content;
}
