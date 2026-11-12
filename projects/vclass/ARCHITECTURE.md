# vclass (web) — Architecture

Web app for practicing a language through roleplay with an animated VRM avatar.
The user picks a language, level and scenario; the AI character opens the
conversation, speaks with TTS, listens through the mic, checks the user's
grammar before sending, and can export the conversation as an Anki deck.

The Python CLI in `projects/vclass-console` implements the same idea in the
terminal. The two apps share nothing at runtime except the files in `shared/`
(the console still keeps its own copy of the Japanese N5 contexts).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, route handlers, `proxy.ts`) |
| UI | React 19 + Tailwind CSS 4 |
| 3D | Three.js + `@pixiv/three-vrm` |
| LLM | OpenRouter chat completions (plain `fetch`, model from `OPENROUTER_MODEL`) |
| TTS / STT | ElevenLabs REST API (`eleven_multilingual_v2`, `scribe_v1`) |
| Lip sync | Web Audio `AnalyserNode` volume → VRM `aa` expression |
| Anki export | `sql.js` (SQLite in WASM) + `jszip` → `.apkg` |
| Tests / lint | Vitest, ESLint (`eslint-config-next`) |

There is no WebSocket and no database: every call is a stateless HTTP request,
and the conversation lives in React state in the browser.

---

## Conversation flow

```
Scenario picked
  └─ POST /api/chat {history: []}        → assistant opens the conversation
       ├─ POST /api/tts                  → audio + lip sync
       └─ POST /api/explain (parallel)   → pre-fetched "explain" content

User types or speaks
  ├─ (speaking) POST /api/stt            → transcript fills the input
  ├─ POST /api/grammar                   → {ok, explanation}
  │     ok=false → input is flagged, user must correct it
  └─ POST /api/chat {history}            → next assistant turn (+ tts, explain)

"End" → POST /api/export/anki {cards}    → .apkg download
```

The client logic lives in `lib/useConversation.ts`. Errors from any step are
shown in a banner above the input with a **Retry** button.

---

## Security model

- **System prompt is server-only.** `/api/chat` accepts only `user`/`assistant`
  turns and rebuilds the system prompt on every request from
  `shared/contexts`, `shared/languages` and `shared/prompts`.
- **Inputs are validated** (`lib/server/shared.ts`): `language` must have a
  `shared/languages/<code>.json`, `level` must be listed in it, and `scenario`
  must be a slug with a matching context file. Paths can't escape `shared/`.
  Text fields, history length, audio size and Anki card counts are capped.
- **The TTS voice is fixed** by `ELEVENLABS_VOICE_ID`; the client can't choose it.
- **Optional password** (`APP_PASSWORD`): `proxy.ts` requires HTTP Basic auth
  for the whole app. Set it whenever the app is reachable from the internet,
  since the API routes spend your OpenRouter/ElevenLabs credits.
- **Rate limit** (`RATE_LIMIT_PER_MINUTE`, default 60, `0` disables): per IP,
  in memory, per server process. It reads `X-Forwarded-For`, so only trust it
  behind a reverse proxy that sets that header.

---

## Directory structure

```
projects/vclass/
├── app/
│   ├── page.tsx                 # layout: avatar + conversation panel
│   └── api/
│       ├── chat/route.ts        # next assistant turn
│       ├── grammar/route.ts     # grammar check (JSON verdict)
│       ├── explain/route.ts     # sentence breakdown
│       ├── tts/route.ts         # ElevenLabs text-to-speech
│       ├── stt/route.ts         # ElevenLabs speech-to-text
│       └── export/anki/route.ts # .apkg generation
├── components/                  # AvatarCanvas, ChatPanel, InputBar, modals
├── lib/
│   ├── server/
│   │   ├── shared.ts            # reads/validates shared/ files, builds prompts
│   │   ├── openrouter.ts        # chatCompletion() with timeout + error handling
│   │   └── http.ts              # apiRoute() wrapper, rate limit, input helpers
│   ├── useConversation.ts       # client conversation state machine
│   ├── scenarios.ts             # language/level/scenario menu
│   ├── AvatarController.ts      # rest pose, blinking, mouth
│   ├── vrm.ts, lipSync.ts       # VRM loading, audio-driven mouth
│   ├── furigana.tsx, text.ts    # furigana rendering / stripping
│   └── types.ts
├── tests/                       # Vitest unit tests
└── proxy.ts                     # optional password protection
```

`shared/` (monorepo root) holds the content: `contexts/<language>/<scenario>.md`
(optionally `contexts/<language>/<level>/<scenario>.md`), `languages/*.json`
(levels and grammar notes appended to the system prompt) and
`prompts/<language>/{grammar,explain,furigana}.txt` (`{sentence}` is replaced).
Prompts are read on each request, so edits apply without a restart.

### Adding a scenario

1. Add `shared/contexts/<language>/<scenario>.md`.
2. Add it to `lib/scenarios.ts` so it shows in the menu.
3. `npm test` checks that every menu entry resolves to a valid prompt.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | LLM access |
| `OPENROUTER_MODEL` | no | default `openai/gpt-4o-mini` |
| `ELEVENLABS_API_KEY` | yes | TTS and STT |
| `ELEVENLABS_VOICE_ID` | yes | avatar voice |
| `APP_PASSWORD` | no | enables the login prompt |
| `RATE_LIMIT_PER_MINUTE` | no | API requests per minute per IP |
| `SHARED_DIR` | no | override the path to `shared/` |

---

## Development

```bash
npm run dev        # dev server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest
npm run build      # production build
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, tests, build and
`npm audit --omit=dev --audit-level=high` on every PR.
