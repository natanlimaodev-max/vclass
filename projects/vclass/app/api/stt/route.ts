import { NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server/http";
import { assertLanguage } from "@/lib/server/shared";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const LANGUAGE_CODES: Record<string, string> = {
  japanese: "ja",
  english: "en",
  portuguese: "pt",
  spanish: "es",
  french: "fr",
  korean: "ko",
  chinese: "zh",
};

// Upstream calls time out at 60s; let the function live that long on serverless hosts.
export const maxDuration = 60;

export const POST = apiRoute(async (req) => {
  const formData = await req.formData().catch(() => {
    throw new HttpError("Invalid form data", 400);
  });
  const audio = formData.get("file");
  if (!(audio instanceof Blob) || audio.size === 0) throw new HttpError("'file' is required", 400);
  if (audio.size > MAX_AUDIO_BYTES) throw new HttpError("Recording is too long", 413);

  const language = formData.get("language");
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new HttpError("ELEVENLABS_API_KEY is not configured", 500);

  const body = new FormData();
  body.append("file", audio, "recording.webm");
  body.append("model_id", "scribe_v1");
  if (language) {
    const code = LANGUAGE_CODES[assertLanguage(language)];
    if (code) body.append("language_code", code);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body,
    signal: AbortSignal.timeout(60_000),
  }).catch((err) => {
    console.error("ElevenLabs STT request failed:", err);
    throw new HttpError("Could not reach the speech service", 502);
  });

  if (!res.ok) {
    console.error("ElevenLabs STT error:", res.status, await res.text().catch(() => ""));
    throw new HttpError(`Transcription error (${res.status})`, 502);
  }

  const data = (await res.json()) as { text?: string };
  // Remove sound annotations: (音) （音） [sound] 【sound】
  const transcript = (data.text ?? "").replace(/[（(【\[][^）)\]】]*[）)\]】]/g, "").trim();
  return NextResponse.json({ transcript });
});
