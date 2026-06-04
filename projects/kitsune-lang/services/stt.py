import sounddevice as sd
import soundfile as sf
from elevenlabs.client import ElevenLabs
import config

_client: ElevenLabs | None = None


def _get_client() -> ElevenLabs:
    global _client
    if _client is None:
        _client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
    return _client


def listen(duration: int = 5, samplerate: int = 44100, language_code: str | None = None) -> str:
    audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1)
    sd.wait()
    sf.write("_tmp_input.wav", audio, samplerate)
    with open("_tmp_input.wav", "rb") as f:
        result = _get_client().speech_to_text.convert(
            file=f,
            model_id="scribe_v1",
            language_code=language_code,
        )
    return result.text
