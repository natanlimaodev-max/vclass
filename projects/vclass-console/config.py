import os
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

def validate():
    missing = [k for k, v in {
        "OPENROUTER_API_KEY": OPENROUTER_API_KEY,
        "ELEVENLABS_API_KEY": ELEVENLABS_API_KEY,
        "ELEVENLABS_VOICE_ID": ELEVENLABS_VOICE_ID,
    }.items() if not v]
    if missing:
        raise EnvironmentError(f"Missing env vars: {', '.join(missing)}")
