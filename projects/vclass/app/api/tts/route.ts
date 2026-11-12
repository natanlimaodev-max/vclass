import { NextResponse } from "next/server";
import { apiRoute, HttpError, readJson, requireText } from "@/lib/server/http";
import { stripFurigana } from "@/lib/text";

/** ElevenLabs premade voice "Rachel", used when ELEVENLABS_VOICE_ID is not set. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Upstream calls time out at 60s; let the function live that long on serverless hosts.
export const maxDuration = 60;

export const POST = apiRoute(async (req) => {
  const body = await readJson(req);
  // Speak only the base text, not the furigana readings.
  const text = stripFurigana(requireText(body.text, "text", 2000));
  // The voice is fixed by the server; the client cannot pick another one.
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new HttpError("ELEVENLABS_API_KEY is not configured", 500);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(60_000),
    }
  ).catch((err) => {
    console.error("ElevenLabs TTS request failed:", err);
    throw new HttpError("Could not reach the speech service", 502);
  });

  if (!res.ok) {
    console.error("ElevenLabs TTS error:", res.status, await res.text().catch(() => ""));
    throw new HttpError(`Speech service error (${res.status})`, 502);
  }

  return new NextResponse(await res.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg" },
  });
});
