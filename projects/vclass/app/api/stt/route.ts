import { NextRequest, NextResponse } from "next/server";

const LANGUAGE_CODES: Record<string, string> = {
  japanese: "ja",
  english: "en",
  portuguese: "pt",
  spanish: "es",
  french: "fr",
  korean: "ko",
  chinese: "zh",
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("file") as Blob;
  const language = formData.get("language") as string | null;

  const body = new FormData();
  body.append("file", audio, "recording.webm");
  body.append("model_id", "scribe_v1");
  if (language) {
    const code = LANGUAGE_CODES[language] ?? language;
    body.append("language_code", code);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ElevenLabs STT error:", res.status, err);
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  // Remove sound annotations: (音) （音） [sound] 【sound】
  const transcript = (data.text as string)
    .replace(/[（(【\[][^）)\]】]*[）)\]】]/g, "")
    .trim();
  return NextResponse.json({ transcript });
}
