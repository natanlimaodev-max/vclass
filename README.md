# Kitsune Agent

Monorepo for AI-powered language learning agents. Terminal-based, LLM + TTS/STT.

## Projects

| Project | Description | Status |
|---------|-------------|--------|
| [kitsune-lang](projects/kitsune-lang/) | Language learning via roleplay conversations | Active |

---

## kitsune-lang

Console agent for practicing languages through immersive roleplay scenarios. Speak or type your responses; the AI speaks back via TTS.

### Features

- **Roleplay Mode** — scenario-based conversations (haircut, job interview, first meeting)
- **Voice I/O** — ElevenLabs TTS (AI speaks) + STT (you speak via mic)
- **JLPT levels** — Japanese N5→N1, grammar constraints enforced per level
- **Pluggable modules** — add new modes without touching `main.py`
- **Swappable LLM** — change model via env var, no code change needed

### Requirements

- Python 3.11+
- [OpenRouter](https://openrouter.ai) API key
- [ElevenLabs](https://elevenlabs.io) API key + Voice ID
- Microphone (for voice input)

### Setup

```bash
cd projects/kitsune-lang
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your API keys
```

**.env**
```env
OPENROUTER_API_KEY=sk-or-...
ELEVENLABS_API_KEY=sk-...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Run

```bash
python main.py
```

### Conversation Flow

```
Load scenario (.md) → LLM generates opening → TTS plays audio
    ↓
User: [1] Speak (mic → STT)  [2] Type  [3] Try Again  [4] Exit
    ↓
Append to history → LLM responds → TTS plays → (loop)
```

### Structure

```
projects/kitsune-lang/
├── main.py              # Entry point, main menu
├── config.py            # API keys, env validation
├── modules/             # Pluggable feature modules
│   └── base.py          # BaseModule interface
├── languages/           # Language + level definitions
│   ├── base.py          # BaseLanguage interface
│   └── japanese.py      # N5–N1 levels, grammar rules
├── services/
│   ├── llm.py           # OpenRouter (OpenAI-compatible)
│   ├── tts.py           # ElevenLabs TTS
│   └── stt.py           # ElevenLabs STT + mic recording
└── utils/
    ├── audio.py          # Audio playback/recording
    └── display.py        # Rich terminal UI helpers
```

### Adding a Module

1. Create `modules/<name>/`
2. Implement class inheriting `BaseModule` with `name` and `run()`
3. Register in `modules/__init__.py`
4. Menu auto-detects it

### Adding a Language

1. Create `languages/<lang>.py` inheriting `BaseLanguage`
2. Define levels and grammar rules
3. Create `contexts/<lang>/` with scenario `.md` files
4. Register in `languages/__init__.py`

### Scenario Format

Scenarios are `.md` files with YAML frontmatter:

```markdown
---
language: japanese
level: N5
scenario: arubaito_interview
voice_id: optional_override
---

## Scenario
You are a Japanese store manager interviewing a part-time worker applicant...

## Grammar Constraints (N5)
- ます/です form only
- JLPT N5 vocabulary

## Opening
Greet the applicant and ask their name.
```

---

## Monorepo Structure

```
kitsune-agent/
├── projects/
│   └── kitsune-lang/
├── shared/              # Future: libs shared across projects
└── README.md
```
