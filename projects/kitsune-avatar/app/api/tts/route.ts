import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text: rawText, voice_id } = await req.json() as { text: string; voice_id?: string };
  const voiceId = voice_id ?? process.env.ELEVENLABS_VOICE_ID;
  // Strip furigana annotations [reading] before TTS — speak only kanji/kana
  const text = rawText.replace(/\s*\[[^\]]+\]/g, "");

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
