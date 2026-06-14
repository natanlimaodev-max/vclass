# Kitsune Agent — Implementation Guide

## Vision

Monorepo (`kitsune-agent/`) com múltiplos projetos. Primeiro projeto: **kitsune-lang** — agente de aprendizado de línguas via console Python, LLM + TTS/STT.

---

## Monorepo Structure

```
kitsune-agent/
├── projects/
│   └── kitsune-lang/          # Language learning agent (projeto inicial)
├── shared/                    # Libs compartilhadas entre projetos futuros
└── README.md
```

---

## Project: kitsune-lang

### Directory Structure

```
projects/kitsune-lang/
├── main.py                    # Entrypoint, menu principal
├── config.py                  # API keys, configurações globais
├── requirements.txt
│
├── modules/                   # Módulos plugáveis (cada um = feature)
│   ├── __init__.py
│   └── roleplay/
│       ├── __init__.py
│       ├── mode.py            # Orquestra o modo roleplay
│       ├── language_selector.py
│       ├── conversation.py    # Loop principal da conversa
│       └── actions.py         # Speak / Continue / Try Again / Exit
│
├── languages/                 # Definições de línguas e níveis
│   ├── __init__.py
│   ├── base.py                # Classe base Language
│   ├── japanese.py            # Níveis N5–N1, regras gramaticais
│   └── english.py
│
├── contexts/                  # Contextos de roleplay (.md)
│   ├── japanese/
│   │   ├── N5/
│   │   │   ├── haircut.md
│   │   │   ├── first_meeting.md
│   │   │   └── arubaito_interview.md
│   │   └── N4/
│   │       └── ...
│   └── english/
│       └── ...
│
├── services/                  # Integrações com APIs externas
│   ├── __init__.py
│   ├── llm.py                 # OpenRouter API client
│   ├── tts.py                 # ElevenLabs TTS
│   └── stt.py                 # ElevenLabs STT
│
└── utils/
    ├── audio.py               # Play audio, record mic
    └── display.py             # Rich terminal UI helpers
```

---

## Technical Requirements

### Runtime
- Python 3.11+
- Ambiente virtual (`venv`)

### Dependencies

| Package | Purpose |
|---------|---------|
| `openai` | OpenRouter é compatível com SDK OpenAI |
| `elevenlabs` | SDK oficial ElevenLabs (TTS + STT) |
| `sounddevice` | Gravação de áudio do microfone |
| `soundfile` | Leitura/escrita de arquivos de áudio |
| `rich` | UI no terminal (menus, formatação) |
| `python-dotenv` | Carregar `.env` com API keys |
| `pydub` | Processamento de áudio (play, conversão) |

### API Keys (`.env`)
```
OPENROUTER_API_KEY=sk-or-...
ELEVENLABS_API_KEY=sk-...
ELEVENLABS_VOICE_ID=...        # ID da voz para TTS
```

---

## Module System

### Como adicionar módulo novo

1. Criar pasta em `modules/<nome>/`
2. Implementar `__init__.py` com classe que herda `BaseModule`
3. Registrar em `modules/__init__.py`
4. Menu em `main.py` detecta automaticamente módulos registrados

```python
# modules/base.py
class BaseModule:
    name: str
    description: str

    def run(self) -> None:
        raise NotImplementedError
```

### Como adicionar língua nova

1. Criar `languages/<lingua>.py` herdando `BaseLanguage`
2. Definir níveis disponíveis e regras por nível
3. Criar pasta `contexts/<lingua>/` com subpastas por nível
4. Registrar em `languages/__init__.py`

---

## Context File Format (.md)

Cada cenário de roleplay é definido por um `.md`:

```markdown
---
language: japanese
level: N5
scenario: arubaito_interview
voice_id: optional_override   # sobrescreve ELEVENLABS_VOICE_ID
---

## Scenario
You are a Japanese store manager interviewing a new part-time worker (arubaito).
The user is the job applicant. Speak only Japanese at N5 level.

## Grammar Constraints (N5)
- Use simple present/past tense
- Vocabulary: JLPT N5 word list only
- Sentence structure: Subject + Object + Verb (SOV)
- Polite form: ます/です only

## Opening
Start by greeting the applicant and asking their name.

## Flow
1. Ask name and age
2. Ask about previous experience
3. Ask about availability
4. Close interview politely
```

---

## Conversation Loop

```
[START]
    │
    ▼
Load context .md
    │
    ▼
Send context to LLM (OpenRouter) → get first message
    │
    ▼
Send LLM text to ElevenLabs TTS → play audio + print text
    │
    ▼
Show user actions:
    1) Speak     → ElevenLabs STT → text
    2) Continue  → user type response
    3) Try Again → clear last user input, repeat
    4) Exit      → end session
    │
    ▼
Append user response to conversation history
    │
    ▼
Send full history to LLM → get next response
    │
    └──────────────────── (loop) ────────────────────►
```

### Conversation History Format (OpenRouter/OpenAI)
```python
history = [
    {"role": "system", "content": "<context.md content>"},
    {"role": "assistant", "content": "こんにちは！お名前は？"},
    {"role": "user",      "content": "田中です。よろしくお願いします。"},
    ...
]
```

---

## Services

### LLM Service (OpenRouter)

```python
# services/llm.py
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

def chat(history: list[dict], model: str = "anthropic/claude-3.5-sonnet") -> str:
    response = client.chat.completions.create(
        model=model,
        messages=history,
    )
    return response.choices[0].message.content
```

### TTS Service (ElevenLabs)

```python
# services/tts.py
from elevenlabs.client import ElevenLabs
from elevenlabs import play

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

def speak(text: str, voice_id: str) -> None:
    audio = client.generate(
        text=text,
        voice=voice_id,
        model="eleven_multilingual_v2",
    )
    play(audio)
```

### STT Service (ElevenLabs)

```python
# services/stt.py
import sounddevice as sd
import soundfile as sf
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

def listen(duration: int = 5, samplerate: int = 44100) -> str:
    audio = sd.rec(int(duration * samplerate), samplerate=samplerate, channels=1)
    sd.wait()
    sf.write("_tmp_input.wav", audio, samplerate)
    with open("_tmp_input.wav", "rb") as f:
        result = client.speech_to_text.convert(audio=f)
    return result.text
```

---

## Main Menu

```
╔══════════════════════════╗
║      KITSUNE AGENT       ║
╚══════════════════════════╝

  1. Roleplay Mode
  2. [future module]
  3. Exit

Select:
```

### Roleplay Sub-menu
```
Select language:
  1. Japanese
  2. English

Select level (Japanese):
  1. N5 (Beginner)
  2. N4
  3. N3
  4. N2
  5. N1 (Advanced)

Select scenario:
  1. Going to the hairdresser
  2. Meeting someone for the first time
  3. Arubaito interview
```

---

## Implementation Phases

### Phase 1 — Skeleton
- [ ] Monorepo structure + `kitsune-lang/` scaffold
- [ ] `main.py` com menu usando `rich`
- [ ] `BaseModule` + `BaseLanguage` abstrações
- [ ] `.env` loading + `config.py`

### Phase 2 — Context System
- [ ] Context `.md` parser (frontmatter + body)
- [ ] Japanese language definition (N5–N1 levels)
- [ ] 3 context files para Japanese N5

### Phase 3 — Services
- [ ] `services/llm.py` — OpenRouter integration
- [ ] `services/tts.py` — ElevenLabs TTS
- [ ] `services/stt.py` — ElevenLabs STT + mic recording

### Phase 4 — Conversation Loop
- [ ] `modules/roleplay/conversation.py` — loop principal
- [ ] History management
- [ ] Actions: Speak / Continue / Try Again / Exit

### Phase 5 — Polish
- [ ] Rich UI (cores, formatação bonita no terminal)
- [ ] Error handling (API failures, mic não disponível)
- [ ] English language + contexts

---

## Notes

- OpenRouter permite trocar modelo LLM sem mudar código (só config)
- ElevenLabs `eleven_multilingual_v2` suporta japonês e inglês nativamente
- Context `.md` com frontmatter YAML = fácil editar/adicionar cenários sem tocar código
- Módulos plugáveis via registro em `__init__.py` = extensível sem modificar `main.py`
