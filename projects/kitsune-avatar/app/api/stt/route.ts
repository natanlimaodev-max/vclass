import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("file") as Blob;

  const body = new FormData();
  body.append("file", audio, "recording.webm");
  body.append("model_id", "scribe_v1");

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
  return NextResponse.json({ transcript: data.text });
}
