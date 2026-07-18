# Miles — Developer Guide

Practical, day-to-day guide for someone actively writing code in this repo. This is not the
design doc (`project-guide.md`), not the plain-language pitch (`project-summary.md`), and not a
vendor manual (`vb-developer-guide.md`, `sabre-developer-guide.txt`) — it's "how do I actually
get something done here." Read `CLAUDE.md` first for current status; this guide assumes you've
done that and README's setup steps.

## Read order

1. `CLAUDE.md` — current status, open issues, critical lessons. The ground truth.
2. `.claude/guides/project-guide.md` — the design doc, before any architectural change.
3. `.claude/miles-design-system.md` — before any frontend/UI change. Never hardcode hex; the
   tokens live in `frontend/index.html` `<style>`.
4. `agents/ACT2.md` — before touching the phone-recovery path. It's a runbook, not a design doc.

## The mental model

Two acts, one brain, **no custom orchestration backend**. Vocal Bridge (VB) is the orchestrator
for both acts — it owns the conversation, the tool-calling loop, and (for Act 1) the client-action
channel to the dashboard. Our code exists to give VB agents something to call, not to sit between
the user and VB.

```
Act 1 (browser)          Act 2 (phone)
Miles ──Sabre MCP──►     Traveler Recovery ──Sabre MCP──► (reshop/modify)
  │                            │
  └─ client actions            ├─ HTTP get_itinerary ──► FastAPI
     (LiveKit data channel)    └─ HTTP call_hotel ──► FastAPI ──vb call──► Hotel Front Desk agent
     ──► React dashboard                                                        │
                                                                    GET /context/hotel_call
```

Both acts share the same architectural rule: **the voice model never invents data.** Every number
it speaks came from a tool call in this same turn or a prior one it can still see. If you're
debugging a hallucinated price or flight time, the fix is almost never "add a prose warning" — see
"Prompt-engineering lessons" below.

## Everyday dev loop — Act 1 (browser)

```bash
uv run uvicorn api.main:app --reload   # terminal 1, port 8000
cd frontend && npm run dev             # terminal 2, port 5173
```

Editing the agent's behavior means editing a file in `agents/` and then pushing it — nothing
takes effect until you push, and the push is **live for everyone** on the one shared agent:

```bash
~/.local/bin/vb prompt set --file agents/miles_prompt.txt
~/.local/bin/vb config set --client-actions-file agents/client_actions.json
~/.local/bin/vb config set --api-tools-file agents/api_tools.json
```

Say in chat before you push. Config changes apply on the *next* call, not mid-call — if you just
pushed and the behavior looks unchanged, you're probably still in the call from before the push.

To see what actually happened in a call:

```bash
~/.local/bin/vb logs                        # recent sessions, session IDs
~/.local/bin/vb logs <session_id> --json    # full transcript INCLUDING tool calls — read this first
```

`vb logs --json` is the primary debugging tool for this whole project. Read the tool-call
arguments and results, not just the transcript text — that's where you'll see a missing
`conversationId`, a malformed offer_id, or a tool that silently returned an error the voice model
glossed over.

Two settings will silently break everything if flipped, and there's no error message when they're
wrong — the call just goes wrong in a way that looks like a prompt bug:

- **AI Agent mode: OFF.** This delegates to an external LangChain-style agent. We don't have one.
- **Background AI: ON.** This is what actually executes `submit_background_query` /
  `check_query_status` — the Sabre workflow chains. Off, and every search "hits a snag."

## Everyday dev loop — Act 2 (phone)

Act 2 needs a public HTTPS tunnel in front of FastAPI, because VB agents call your tools from the
cloud, not from localhost. Full step-by-step is `agents/ACT2.md` — short version:

```bash
cloudflared tunnel --url http://localhost:8000   # or paid ngrok; free ngrok's interstitial
                                                  # page breaks VB HTTP tools (HTML instead of JSON)
# set PUBLIC_BASE_URL in .env to the tunnel URL
./agents/setup_act2.sh     # creates/configures Traveler + Hotel agents, writes IDs into .env
./agents/check_act2.sh     # readiness check — fix any FAIL before continuing
```

Debug endpoints that let you exercise the recovery flow without waiting for a real Act 1 booking:

```bash
curl -X POST http://localhost:8000/debug/persist-booking -d '{...}'   # seed a booking (see ACT2.md for shape)
curl http://localhost:8000/debug/booking/<session_id>                 # confirm it stuck
curl -X POST http://localhost:8000/debug/cancel/<PNR>                 # trigger the recovery call
```

`api/routes/recovery.py` (`/tools/call_hotel`) and `api/vb_call.py` (the `vb call` subprocess
wrapper) are the two files to know if something in the nested-hotel-call path misbehaves — that
route drives the whole "hold music while we call the hotel" sequence via SSE events
(`hotel_call_status`, `traveler_callback_status`, `recovery_confirmed`).

Two Act-2-specific gotchas not covered above:

- The tunnel URL changes every restart. After that: update `PUBLIC_BASE_URL`, then re-run
  `./agents/setup_act2.sh` (or just `patch_act2_tools.sh` to only rewrite tool URLs).
- Restart FastAPI after editing `.env` — `uvicorn --reload` picks up code changes but env vars are
  read once at process start.

**Status note:** the Act 2 code (routes, both prompts, provisioning scripts) is committed and
wired per `agents/ACT2.md`, but treat it as *implemented, not yet confirmed working end-to-end* —
check `CLAUDE.md`'s current-status section rather than assuming from the code alone. Also:
`frontend/src/components/PhoneCallPanel.tsx` and `SeatMapCard.tsx` exist but aren't imported
anywhere yet — building the phone-recovery visualization means wiring one of those in, not
starting from scratch.

## Frontend notes

- `App.tsx` gates on `SignupPage` (local profile in `localStorage` via `profile.ts`) before
  rendering `VocalBridgeProvider` — `TripApp.tsx` is where all the VB (`useVocalBridge`,
  `useTripActions`) and SSE (`useSSE`) hooks live. Keep that split: `useAgentActions`/
  `useVocalBridge` must run inside `VocalBridgeProvider`.
- `useTripActions.ts` is the client-action listener — this is what actually populates the
  dashboard. If a client action isn't showing up, check here first, then check
  `agents/client_actions.json` has the action defined, then check `vb logs --json` to see if VB
  even fired it.
- `useSSE.ts` is Act 2's event stream (`hotel_call_status`, `traveler_callback_status`,
  `recovery_confirmed`, leg status) — separate channel from VB client actions, backed by
  `api/routes/events.py`.
- Dashboard renders **only** from these two channels, never from the raw transcript.
- Never add an eager `/api/voice-token` fetch on page load or outside `VocalBridgeProvider`'s own
  flow — each token mint spawns a VB agent session, and duplicates fight over the room. This bit
  the project once already.

## Prompt-engineering lessons (apply these before re-inventing them)

- **The realtime voice model follows numbered flow steps, not prose "CRITICAL" warnings.** If you
  need the model to do something specific and load-bearing (paste a literal ID, poll a job,
  refuse an action without explicit yes), put it in the numbered conversation-flow step as a
  copy-paste template, not in a prose rules section above or below the flow.
- **Sabre `conversationId` must travel with `offer_id`/`property_id` across background jobs** —
  background query jobs are isolated per Sabre conversation. A query that says "reuse the
  conversationId from earlier" (prose reference) will fail; a query that has the literal UUID
  pasted in will work. Same idea applies to any voice-model output.
- VB auto-pushes completed background-job results to the agent — you don't need the prompt to
  poll aggressively for short jobs, only for the long ones (booking commit, ~60s+).
- `vb mcp test "<query>"` runs a background MCP job **without a voice call** — the fastest way to
  test a Sabre/Zapier tool chain change before burning a real call on it.

## File map (both acts)

```
agents/
  miles_prompt.txt         Act 1 system prompt — most load-bearing file in the repo
  client_actions.json      dashboard action schema (see README repo map for current list)
  api_tools.json           get_weather (Open-Meteo, keyless)
  mcp_servers.json         gitignored — Sabre + Zapier MCP config; `vb config set --mcp-servers-file`
                           REPLACES the whole list, so both must always be present when pushing
  ACT2.md                  Act 2 operator runbook
  traveler_prompt.txt / traveler_tools.json   Traveler Recovery (outbound call to traveler)
  hotel_prompt.txt / hotel_tools.json         Hotel Front Desk (nested call, no Sabre MCP)
  setup_act2.sh / patch_act2_tools.sh / check_act2.sh   Act 2 provisioning + smoke tests

api/
  routes/voice.py          /api/voice-token — Act 1's only live dependency
  routes/events.py         Act 2: /debug/persist-booking, /debug/cancel/{pnr}, /debug/booking/*, SSE emit
  routes/context.py        Act 2: /tools/get_itinerary, /context/hotel_call
  routes/recovery.py       Act 2: /tools/call_hotel — the nested-call orchestration
  routes/paypal.py         PayPal sandbox orders API (checkout page)
  vb_call.py               async wrapper around the `vb` CLI (`vb agent use`, `vb call`)
  tools.py / state.py      legacy Act 1 HTTP-tool backend — superseded by MCP-direct, unused live

frontend/src/
  App.tsx                  SignupPage gate → VocalBridgeProvider
  TripApp.tsx              all VB + SSE hooks; routes between Home/Dashboard/Itinerary/Checkout
  hooks/useTripActions.ts  VB client-action listener (Act 1 dashboard data source)
  hooks/useSSE.ts          Act 2 event stream (Act 2 dashboard data source)
  components/Dashboard.tsx, TripCard.tsx, TripSummaryCard.tsx, DestinationGuideCard.tsx
  components/HomeDashboard.tsx, ItineraryPage.tsx, CheckoutPage.tsx, SignupPage.tsx, VoiceDock.tsx
  components/PhoneCallPanel.tsx, SeatMapCard.tsx    built, not yet wired into any parent component

sabre/      legacy MCP client, unused by Act 1's live path
contracts/  FROZEN — never touch without explicit human sign-off
```

## Rules that will bite you if you skip them

- One shared live VB agent — a `vb prompt set` / `vb config set` changes it for everyone,
  immediately. Announce before pushing.
- `contracts/` is frozen. Don't touch it, even for a "trivial" fix, without asking.
- Never commit `.env` or `.claude/guides/sabre-developer-guide.txt` — both hold live secrets.
- No partial bookings — one PNR, written only after every leg the traveler picked is confirmed.
- Voice responses are prose, 1–2 sentences. Structured data belongs on the dashboard, never in
  what the voice says out loud.
