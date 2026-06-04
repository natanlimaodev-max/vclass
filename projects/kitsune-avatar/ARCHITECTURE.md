# kitsune-avatar — Architecture

## Vision

Web-based language learning agent with an animated VRM 3D avatar. User converses with the AI character through the browser — the avatar speaks, reacts with expressions, and listens via mic. Parallel project to `kitsune-lang` (Python CLI); same concept, different interface.

---

## Monorepo Position

```
kitsune-agent/
├── projects/
│   ├── kitsune-lang/     # Python CLI agent (existing)
│   └── kitsune-avatar/   # Web agent with VRM avatar (this project)
├── shared/               # Future: shared types/constants
└── README.md
```

`kitsune-avatar` is self-contained — no runtime dependency on `kitsune-lang`. Both projects implement the same language learning loop independently.

---

## Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 15 (App Router) | Frontend + API in one project |
| Language | TypeScript | Type safety across front and back |
| 3D Rendering | Three.js + `@pixiv/three-vrm` | VRM standard, maintained by Pixiv |
| UI | React + Tailwind CSS | Component model, utility styling |
| Real-time | WebSocket (native `ws`) | Avatar event stream from server to client |
| LLM | OpenRouter (fetch, OpenAI-compatible) | Swap models via env var |
| TTS | ElevenLabs JS SDK | Same provider as kitsune-lang |
| STT | ElevenLabs JS SDK | Browser `MediaRecorder` → API Route |
| Audio | Web Audio API (browser native) | Playback + volume analysis for lip sync |

---

## Architecture Overview

```
Browser
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────────────┐        ┌───────────────────────┐  │
│  │  VRM Renderer │◄──────│   Avatar Controller   │  │
│  │  (Three.js)  │        │  (expressions, bones) │  │
│  └──────────────┘        └───────────┬───────────┘  │
│                                      │               │
│  ┌──────────────┐        ┌───────────▼───────────┐  │
│  │   Mic Input  │        │    WebSocket Client   │  │
│  │ (MediaRecorder)       │  receives avatar events│  │
│  └──────┬───────┘        └───────────────────────┘  │
│         │                                            │
└─────────┼──────────────────────────────────────────-┘
          │ HTTP                            ▲ WS
          ▼                                │
Next.js Server
┌─────────────────────────────────────────────────────┐
│                                                     │
│  API Routes                WebSocket Server         │
│  ┌────────────────┐        ┌─────────────────────┐  │
│  │ POST /api/chat │        │  /api/ws             │  │
│  │  → OpenRouter  │        │  pushes avatar events│  │
│  ├────────────────┤        │  to connected client │  │
│  │ POST /api/tts  │        └─────────────────────┘  │
│  │  → ElevenLabs  │                                  │
│  ├────────────────┤                                  │
│  │ POST /api/stt  │                                  │
│  │  → ElevenLabs  │                                  │
│  └────────────────┘                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Conversation Flow

```
[User opens browser]
        │
        ▼
Load VRM model → idle animation starts
        │
        ▼
User selects language + level + scenario
        │
        ▼
POST /api/chat (system prompt from scenario)
        │
        ▼
LLM returns opening line
        │
        ▼
POST /api/tts → returns audio bytes
        │
        ├──► Browser plays audio (Web Audio API)
        │         │
        │         └──► Lip sync: volume → mouth BlendShape
        │
        └──► WS emits { type: "expression", name: "happy", value: 0.8 }
                  │
                  └──► Avatar Controller applies expression
        │
        ▼
User action:
  [🎤 Speak]  → MediaRecorder captures → POST /api/stt → text
  [⌨️  Type]  → text input
  [↩️  Retry] → discard last user turn
  [🚪 Exit]  → end session
        │
        ▼
Append to history → POST /api/chat → next LLM response → (loop)
```

---

## Avatar Event Protocol

Server → Client over WebSocket. All events are JSON.

```ts
type AvatarEvent =
  | { type: "expression"; name: ExpressionName; value: number }  // 0.0–1.0
  | { type: "speak";      duration_ms: number }                  // triggers lip sync
  | { type: "idle" }                                             // return to neutral
  | { type: "blink" }                                            // forced blink
```

```ts
type ExpressionName =
  | "happy" | "sad" | "surprised" | "angry" | "relaxed"  // VRM preset
  | "aa" | "ih" | "ou" | "ee" | "oh"                     // viseme (lip sync)
```

### Emotion detection

LLM response is passed through a lightweight classifier (second LLM call with small/fast model, or regex heuristics) to extract `ExpressionName` before TTS plays. This keeps lip sync and expression in sync with audio.

---

## Lip Sync Strategy

No phoneme analysis. Volume-based approximation:

```
Web Audio API AnalyserNode → getByteFrequencyData() each frame
→ compute RMS volume (0.0–1.0)
→ vrm.expressionManager.setValue("aa", volume * 0.9)
→ vrm.update(delta)
```

Good enough for conversational pacing. Can upgrade to phoneme-level later with a dedicated library.

---

## Directory Structure

```
projects/kitsune-avatar/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                  # Main UI: scenario selector + chat + avatar canvas
│   └── api/
│       ├── chat/route.ts         # POST: LLM via OpenRouter
│       ├── tts/route.ts          # POST: text → audio bytes (ElevenLabs)
│       ├── stt/route.ts          # POST: audio blob → transcript (ElevenLabs)
│       └── ws/route.ts           # WebSocket upgrade: avatar event stream
│
├── components/
│   ├── AvatarCanvas.tsx          # Three.js scene, VRM loader, render loop
│   ├── AvatarController.ts       # BlendShape + bone control API
│   ├── ChatPanel.tsx             # Conversation history display
│   ├── InputBar.tsx              # Speak / Type / Retry / Exit actions
│   └── ScenarioSelector.tsx      # Language + level + scenario picker
│
├── lib/
│   ├── vrm.ts                    # VRM loader wrapper (@pixiv/three-vrm)
│   ├── lipSync.ts                # Web Audio volume → mouth BlendShape
│   ├── wsClient.ts               # WebSocket client singleton
│   ├── conversation.ts           # History management, chat loop logic
│   └── emotion.ts                # LLM response → ExpressionName classifier
│
├── contexts/                     # Same .md scenario format as kitsune-lang
│   ├── japanese/
│   │   └── N5/
│   │       ├── haircut.md
│   │       ├── first_meeting.md
│   │       └── arubaito_interview.md
│   └── english/
│
├── public/
│   └── models/
│       └── kitsune.vrm           # VRM model file
│
├── .env.local
├── .env.example
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## API Routes

### `POST /api/chat`

```ts
// Request
{ history: Message[], model?: string }

// Response
{ content: string, emotion: ExpressionName }
```

### `POST /api/tts`

```ts
// Request
{ text: string, voice_id?: string }

// Response
audio/mpeg stream (streamed for lower latency)
```

### `POST /api/stt`

```ts
// Request
multipart/form-data: audio blob (webm/wav)

// Response
{ transcript: string }
```

### `GET /api/ws`

WebSocket upgrade. Server holds connection per session, pushes `AvatarEvent` JSON frames. One connection per browser tab.

---

## Environment Variables

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
ELEVENLABS_API_KEY=sk-...
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

---

## Implementation Phases

### Phase 1 — Static VRM renderer
- Next.js project scaffold
- `AvatarCanvas` with VRM loaded and idle loop
- Manual BlendShape control via `AvatarController` (no conversation yet)

### Phase 2 — Conversation backend
- `/api/chat`, `/api/tts`, `/api/stt` routes
- `ChatPanel` + `InputBar` UI
- Text-only conversation loop (no avatar animation yet)

### Phase 3 — Avatar integration
- WebSocket server + client
- Emotion classifier wired to `/api/chat` response
- WS pushes `expression` events → `AvatarController` applies
- TTS audio plays in browser

### Phase 4 — Lip sync
- `lipSync.ts` — Web Audio AnalyserNode → mouth BlendShape per frame
- Synchronized with TTS audio playback

### Phase 5 — Polish
- Scenario selector UI
- Idle animations (random blinks, subtle head sway)
- Error states, loading indicators
- Mobile layout

---

## Shared with kitsune-lang

- Scenario `.md` format — identical frontmatter + body structure
- Language/level definitions — may extract to `shared/` as JSON later
- API providers — same OpenRouter + ElevenLabs keys work for both projects
