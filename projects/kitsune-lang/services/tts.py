import os
import subprocess
import tempfile
from elevenlabs.client import ElevenLabs
import config

_client: ElevenLabs | None = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        _client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
    return _client


def speak(text: str, voice_id: str | None = None) -> None:
    used_voice = voice_id or config.ELEVENLABS_VOICE_ID
    print(f"[TTS] calling ElevenLabs: voice_id={used_voice}, text={text[:40]!r}...")
    chunks = _get_client().text_to_speech.convert(
        text=text,
        voice_id=used_voice,
        model_id="eleven_multilingual_v2",
    )
    audio_bytes = b"".join(chunks)
    print(f"[TTS] received {len(audio_bytes)} bytes")
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    print(f"[TTS] playing {tmp_path} via ffplay")
    try:
        result = subprocess.run(
            ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", tmp_path],
            check=True,
        )
        print(f"[TTS] ffplay done, returncode={result.returncode}")
    finally:
        os.unlink(tmp_path)
