# vclass

Monorepo for AI-powered Japanese language learning agents.

## Projects

| Project | Description | Interface | Status |
|---------|-------------|-----------|--------|
| [vclass](projects/vclass/) | Roleplay with animated 3D avatar | Web (Next.js) | Active |
| [vclass-console](projects/vclass-console/) | Roleplay via terminal | CLI (Python) | Active |

---

## vclass

Web app for practicing Japanese through immersive roleplay with an animated VRM avatar. The avatar speaks back via TTS, listens via mic, checks your grammar before sending, and exports Anki decks from your conversation.

### Features

- **3D Avatar** — animated VRM character with lip sync
- **Roleplay scenarios** — first meeting, haircut, job interview (JLPT N5)
- **Voice I/O** — ElevenLabs TTS + STT with language-aware transcription
- **Grammar check** — blocks send until grammar is corrected; explains issues
- **Explain** — detailed breakdown of any sentence (pre-fetched, no extra clicks)
- **Anki export** — exports conversation as `.apkg` deck with audio per card

### Requirements

- [OpenRouter](https://openrouter.ai) API key
- [ElevenLabs](https://elevenlabs.io) API key + Voice ID
- VRM model files (not included — see below)
- Docker (recommended) or Node.js 20+

### Quickstart with Docker

```bash
git clone https://github.com/natanlimaodev-max/vclass.git
cd vclass

# 1. Configure environment
cp projects/vclass/.env.example projects/vclass/.env.local
# Edit .env.local with your API keys

# 2. Add VRM model(s) — place your .vrm file at:
#    projects/vclass/public/models/<ModelName>/_VRM/<ModelName>.vrm
#    Default model path: public/models/Arisa/_VRM/Arisa.vrm

# 3. Run
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

### Quickstart without Docker

```bash
cd projects/vclass
npm install

cp .env.example .env.local
# Edit .env.local with your API keys

npm run dev
```

### Environment Variables

```env
OPENROUTER_API_KEY=sk-or-...        # openrouter.ai
ELEVENLABS_API_KEY=sk-...           # elevenlabs.io
ELEVENLABS_VOICE_ID=21m00Tcm4T...   # voice ID from ElevenLabs dashboard
OPENROUTER_MODEL=openai/gpt-4o-mini # any model on OpenRouter
```

### VRM Models

VRM files are not included in this repo. Place your model at:

```
projects/vclass/public/models/<Name>/_VRM/<Name>.vrm
```

The default expected path is `public/models/Arisa/_VRM/Arisa.vrm`.  
Free VRM models: [VRoid Hub](https://hub.vroid.com)

---

## vclass-console

Console agent for practicing Japanese through immersive roleplay scenarios. Speak or type; the AI speaks back via TTS.

### Requirements

- Python 3.11+
- [OpenRouter](https://openrouter.ai) API key
- [ElevenLabs](https://elevenlabs.io) API key + Voice ID
- Microphone (for voice input)
- `ffplay` (from ffmpeg) for audio playback

### Setup

```bash
cd projects/vclass-console
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env with your API keys

python main.py
```

---

## Monorepo Structure

```
vclass/
├── projects/
│   ├── vclass/     # Next.js web app
│   └── vclass-console/       # Python CLI
├── shared/
│   ├── contexts/           # Scenario .md files (shared by both projects)
│   └── prompts/            # LLM prompt templates
├── docker-compose.yml
└── README.md
```
