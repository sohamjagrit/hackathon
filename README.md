# Miles — Voice-Native Travel Agent

Submission for the **DeepLearning.AI Voice AI Hackathon** (Sabre × Vocal Bridge, July 18 2026, Mountain View).

A voice agent ("Miles") that books **real Sabre flights + hotels (live PNRs)** by conversation:

- **Act 1 — Book by voice (browser):** user talks over the web mic, picks a flight and hotel, Miles
  creates a real Sabre booking while a read-only React dashboard fills in live via Vocal Bridge
  client actions. While the booking commits (~1 min), Miles plays concierge (weather, restaurants).
- **Act 2 — Disruption recovery (phone):** flight gets cancelled, Miles phones the traveler, replans
  with approval gates, and places a real nested call to the hotel — all in one call. *(Not started yet.)*

## How it works (current architecture — read this first)

There is **no orchestration backend**. Vocal Bridge (VB) is the orchestrator:

```
User voice ↔ VB agent "Miles" ──── Sabre MCP server (attached directly to the VB agent)
                    │
                    └── client actions (LiveKit data channel) ──► React dashboard
Browser ──► FastAPI /api/voice-token (the ONLY live backend dependency) ──► VB token
```

- Miles calls Sabre MCP tools directly; slow 15–25s Sabre chains run via VB **Background AI**
  (`submit_background_query` / `check_query_status`).
- Miles normalizes Sabre responses and pushes them to the dashboard by triggering client actions
  (`show_flights`, `flight_selected`, `booking_confirmed`, …). React listens via `useAgentActions`.
- `api/routes/tools.py`, `api/state.py`, and `sabre/client.py` are **legacy** (kept for Act 2 reuse).

**Before touching anything architectural, read `CLAUDE.md` and `.claude/guides/project-guide.md`.**

## Getting set up

### 1. Prerequisites

- **uv** (Python manager): `curl -LsSf https://astral.sh/uv/install.sh | sh` — Python 3.12 is pinned
  in `.python-version`; uv fetches it automatically.
- **Node.js 20+** and npm.
- **Git** with access to this repo (`sohamjagrit/hackathon`, private — ask Soham for an invite).

### 2. Clone and install

```bash
git clone https://github.com/sohamjagrit/hackathon.git
cd hackathon
uv sync                      # Python deps into .venv
cd frontend && npm install   # React deps
cd ..
uv tool install vocal-bridge # installs the `vb` CLI to ~/.local/bin/vb
```

### 3. Secrets — get `.env` from Soham

`.env` is gitignored and never committed. Copy `.env.example` to `.env` and fill it in —
**the fastest path is to ask Soham for his `.env` directly** (Signal/DM, not the repo). What each key is:

| Key | Where it comes from |
|---|---|
| `SABRE_TOKEN` | Hackathon portal. **Expires ~2026-07-20** — regenerate there if Sabre calls 401. |
| `SABRE_PCC` | `S5OM` (capital letter O, not zero). |
| `VOCAL_BRIDGE_API_KEY` | vocalbridgeai.com → API Keys tab. We share ONE team key. |
| `VB_AGENT_ID` | `e1799708-ac1a-44fb-a6a5-6f20816b0a3b` — the shared live "Miles" agent. |
| `ANTHROPIC_API_KEY` | console.anthropic.com (used by the legacy `sabre/client.py` path only). |
| `PAYPAL_CLIENT_ID/SECRET` | developer.paypal.com sandbox app (checkout page). |

Also gitignored: `.claude/guides/sabre-developer-guide.txt` (contains the live Sabre token) —
ask Soham for a copy if you need the Sabre reference doc.

### 4. Run it

Two terminals:

```bash
# Terminal 1 — backend (only serves /api/voice-token)
uv run uvicorn api.main:app --reload        # port 8000

# Terminal 2 — frontend
cd frontend && npm run dev                  # port 5173
```

Open http://localhost:5173, click the mic, allow browser mic access, and talk to Miles
("I need a flight from Orlando to Cancun next weekend"). Flight search takes 15–25s — Miles
fills the silence; booking commit takes 60s+.

## Working on the VB agent (the important part)

The agent's brain lives in `agents/` and is **pushed to the live shared agent** with the `vb` CLI —
config changes take effect on the *next* call, not mid-call:

```bash
~/.local/bin/vb config show                                        # all settings at a glance
~/.local/bin/vb prompt set --file agents/miles_prompt.txt          # push system prompt
~/.local/bin/vb config set --client-actions-file agents/client_actions.json
~/.local/bin/vb config set --api-tools-file agents/api_tools.json  # currently just get_weather
~/.local/bin/vb logs                                               # recent sessions
~/.local/bin/vb logs <session_id> --json                           # transcript + tool calls (primary debug tool)
```

⚠️ **There is one shared Miles agent.** A `vb prompt set` or `vb config set` changes it for everyone
immediately. Announce in chat before pushing, and always edit the file in `agents/` first so the repo
stays the source of truth.

Two settings that break everything if flipped (see CLAUDE.md "critical lessons"):
- **AI Agent mode: OFF** (it delegates to an external agent we don't have).
- **Background AI: ON** (it's what executes the Sabre MCP tool chains).

## Repo map

```
agents/     VB config — SOURCE OF TRUTH: miles_prompt.txt (most load-bearing file),
            client_actions.json (6 actions), api_tools.json (get_weather)
frontend/   React: App.tsx (VocalBridgeProvider only) → TripApp.tsx (all VB hooks) →
            VoicePanel + Dashboard + ItineraryPage + CheckoutPage; useTripActions.ts = client-action listener
api/        FastAPI — /api/voice-token is the only live endpoint; tools.py/state.py are legacy
sabre/      Legacy Python MCP client — unused by Act 1, candidate for Act 2
contracts/  FROZEN legacy reference — do not change without asking
.claude/    Design docs (guides/) + Sabre skill references (sabre-skills/)
CLAUDE.md   Current status, commands, rules — the living doc; keep it updated
```

## Rules that matter

- Dashboard renders **only** from VB client actions, never from the transcript.
- Voice responses are prose, 1–2 sentences; structured data goes to the dashboard.
- `offer_id` / `property_id` / Sabre `conversationId` must be copied **verbatim** between
  background jobs — offer IDs are only valid inside the Sabre conversation that produced them.
- **No partial bookings** — one PNR, created after all legs are confirmed.
- Never commit `.env` or `.claude/guides/sabre-developer-guide.txt`.

## Current status / what to pick up

See the "Current status" and "Open issues" sections at the top of `CLAUDE.md` — kept current.
As of 2026-07-16: Act 1 verified end-to-end in a real call **except the booking commit**
(conversationId isolation fix pushed, needs re-test via `vb logs`); Act 2 not started.
