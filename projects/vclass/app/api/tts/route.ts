import { NextResponse } from "next/server";
import { apiRoute, HttpError, readJson, requireText } from "@/lib/server/http";
import { stripFurigana } from "@/lib/text";

/** ElevenLabs premade voice "Rachel", used when ELEVENLABS_VOICE_ID is not set. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const API = "https://api.elevenlabs.io/v1";

// Upstream calls time out at 60s; let the function live that long on serverless hosts.
export const maxDuration = 60;

/** Voice that replaced a rejected one (cached for the lifetime of the server instance). */
let fallbackVoiceId: string | null = null;

function synthesize(apiKey: string, voiceId: string, text: string): Promise<Response> {
  return fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch((err) => {
    console.error("ElevenLabs TTS request failed:", err);
    throw new HttpError("Could not reach the speech service", 502);
  });
}

/**
 * Free ElevenLabs accounts can't use Voice Library voices through the API, only
 * the premade (default) ones. Find a premade voice available to this key.
 */
async function findPremadeVoice(apiKey: string, exclude: string): Promise<string | null> {
  const res = await fetch(`${API}/voices`, {
    headers: { "xi-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error("Could not list ElevenLabs voices:", res?.status, await res?.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { voices?: Array<{ voice_id: string; name?: string; category?: string }> };
  const voice = data.voices?.find((v) => v.category === "premade" && v.voice_id !== exclude);
  if (voice) {
    console.warn(
      `ElevenLabs voice ${exclude} needs a paid plan; using premade voice "${voice.name}" (${voice.voice_id}). ` +
        `Set ELEVENLABS_VOICE_ID=${voice.voice_id} to make this permanent.`
    );
  }
  return voice?.voice_id ?? null;
}

export const POST = apiRoute(async (req) => {
  const body = await readJson(req);
  // Speak only the base text, not the furigana readings.
  const text = stripFurigana(requireText(body.text, "text", 2000));
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new HttpError("ELEVENLABS_API_KEY is not configured", 500);
  // The voice is fixed by the server; the client cannot pick another one.
  const configured = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  let res = await synthesize(apiKey, fallbackVoiceId ?? configured, text);

  if (res.status === 402 && !fallbackVoiceId) {
    const detail = await res.text().catch(() => "");
    console.error("ElevenLabs TTS error:", res.status, detail);
    if (detail.includes("paid_plan_required")) {
      fallbackVoiceId = await findPremadeVoice(apiKey, configured);
      if (fallbackVoiceId) res = await synthesize(apiKey, fallbackVoiceId, text);
    }
    if (!res.ok && res.status === 402) {
      throw new HttpError(
        "This voice needs a paid ElevenLabs plan. Set ELEVENLABS_VOICE_ID to one of your account's default voices.",
        502
      );
    }
  }

  if (!res.ok) {
    console.error("ElevenLabs TTS error:", res.status, await res.text().catch(() => ""));
    throw new HttpError(`Speech service error (${res.status})`, 502);
  }

  return new NextResponse(await res.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg" },
  });
});
