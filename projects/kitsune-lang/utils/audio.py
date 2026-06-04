import sounddevice as sd
import soundfile as sf
from pathlib import Path


def record(path: str | Path, duration: int = 5, samplerate: int = 44100) -> None:
    audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1)
    sd.wait()
    sf.write(str(path), audio, samplerate)
