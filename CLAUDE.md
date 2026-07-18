This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A submission for the **DeepLearning.AI Voice AI Hackathon** (Sabre × Vocal Bridge, **July 18 2026**,
Mountain View): a voice-native travel agent with two acts sharing one brain.

- **Act 1 — Book by voice (browser):** the user talks (web mic, Vocal Bridge), picks a flight and
  hotel, and the agent creates a **real Sabre booking (PNR)** while a read-only dashboard fills in
  live via VB client actions. While the booking commits (~1 min), Miles plays concierge: weather,
  restaurants, things to do.
- **Act 2 — Disruption recovery (phone, one call):** the flight is cancelled; the agent phones the
  traveler, replans flight → hotel with an approval gate at each step, puts the traveler on a brief
  hold while it places a **real nested phone call to the hotel**, then confirms — all in a single call.

**Read `.claude/guides/project-guide.md` (the DESIGN doc) before any architectural task.** Plain-language
version: `.claude/guides/project-summary.md`. Vendor refs: `.claude/guides/vb-developer-guide.md`,
`.claude/guides/sabre-developer-guide.txt`, and the Sabre skill guides in `.claude/sabre-skills/`.
**For any frontend/UI work, read `.claude/miles-design-system.md` first.** It is the authoritative
visual spec: colors, typography, layout, component patterns. Never hardcode hex values — derive from
the design tokens defined there.

## Current status (as of 2026-07-17)

**Architecture (second pivot) — MCP-DIRECT. No LangGraph, no HTTP tool backend:**
- ❌ LangGraph deleted (first pivot). ❌ FastAPI HTTP tools removed from VB (second pivot) —
  VB tool calls through free-tier ngrok failed (interstitial/blocking → Miles's "technical glitch").
- ✅ **Miles calls Sabre MCP tools directly.** The Sabre MCP server is attached to the VB agent
  (VB dashboard MCP feature, Bearer `SABRE_TOKEN`, 10 tools). VB's **Background AI** runs the slow
  15–25s Sabre workflow chains via `submit_background_query` / `check_query_status`.
- ✅ **Dashboard driven by VB client actions** over the LiveKit data channel — Miles normalizes
  Sabre responses herself and triggers `show_flights` etc. React listens via `useAgentActions`.
- ✅ **FastAPI backend survives ONLY for `/api/voice-token`** (mints the VB token). `api/routes/tools.py`,
  the state store, and `sabre/client.py` are unused by Act 1 (kept for Act 2 phone-tool reuse).
- ✅ **`get_weather` HTTP tool** → Open-Meteo, keyless, direct HTTPS — the one VB api-tool that
  remains, and it needs no ngrok. (`OPENWEATHER_API_KEY` in `.env` is empty; Open-Meteo replaced it.)
- ✅ **Web search enabled** on the VB agent for live restaurant/attraction recommendations.
- ✅ **UI redesigned to Miles design system (7/17).** Fonts: Bricolage Grotesque (headings) +
  DM Sans (body). Brand blue `#2743F4` replaces old teal. Cream `#FFF7E4` canvas, white cards,
  ink `#232323` text. VoicePanel: 380px, ephemeral transcript (last utterance only). Success
  green `#2F6B4F` for confirmed states. Semantic warning/error tokens for loading/cancelled.
  All CSS custom properties in `index.html`; never use hardcoded hex in components.

**VB agent config — critical lessons (all verified via CLI):**
- ⚠️ **"AI Agent mode" in VB means delegating to an EXTERNAL custom agent (LangChain etc.). We
  don't have one — it must stay OFF.** Turning it on routes searches into a void ("hit a snag").
- ⚠️ **Background AI must be ON** (`--background-enabled true`) — it's what executes MCP tool chains.
- The "connect voice to" wizard choice is **"An app (web or mobile)"** (client actions), not "An AI agent".

**Act 1 — VERIFIED WORKING end-to-end in a real voice call, except booking commit:**
- ✅ Greeting → collect details → flight search (real Sabre data) → `show_flights` cards →
  select → hotel search → cards → select → confirmation readback. All client actions fired.
- ⚠️ **Booking failed twice; template fix v2 pushed, needs re-test** (see "Booking fix v2"
  under next tasks). Root cause: VB background query jobs are **isolated** — a Sabre `offer_id`
  is only valid inside the Sabre `conversationId` that produced it — and prose rules alone did
  not change the voice model's behavior.
- ✅ Flight results: prompt asks the search job for up to 15 DISTINCT itineraries (dedupe =
  same flight numbers + times → keep cheapest); TripCard renders up to 15.
- ✅ Concierge-while-booking behavior in prompt: weather (get_weather) + restaurants/places
  (background query + web search) during the ~1 min booking wait.

**Open issues / next tasks (in priority order):**
1. **🔥 Re-test the booking commit** with the template fix v2 (see below). Watch `vb logs <session> --json`.
2. **Post-booking flow (Act 1 extension) — decided 7/16 night; email DONE, rest not built.** See
   "Post-booking flow" section below for the full spec (seats, FF number, bags/meals TODO;
   itinerary email ✅; ID upload ✂️ cut).
3. **Act 2 — not started.** Create `traveler` and `hotel` VB agents; recovery flow (cancelled
   flight → FlightReshop → modifyBooking → approval gates → nested hotel call); wire
   `/debug/cancel/{pnr}`. The change/cancel Sabre APIs (flightReshop, cancelBooking,
   voidFlightTickets, refundFlightTickets, checkFlightTickets) are RESERVED for Act 2 —
   do not expose them in Miles's Act 1 prompt.
4. PayPal sandbox checkout page polish (frontend CheckoutPage exists).
5. ✅ ~~UI redesign~~ — done 7/17 (see design system note above).

**Booking fix v2 (pushed 7/16 night, needs re-test):** the first prose-rule fix FAILED — the
realtime voice model ignores prose "CRITICAL" sections; it follows the numbered flow steps.
Session e75ddb1c: Miles's booking query literally said "conversationId from previous workflow
steps" and she polled once then stopped. The prompt now embeds copy-paste QUERY TEMPLATES in
flow steps 3/5/8 (search queries must end with "CONVERSATION_ID: <id>" line; booking pastes the
literal id; flightDetails fallback books ATPCO without an offer_id if the id is lost), plus a
poll-every-turn rule. **Lesson: behavior changes go in the flow steps as literal templates, not
in prose rule sections.** Note: VB auto-pushes completed background-job results to Miles — she
only needs to poll the long booking job.

## Post-booking flow (Act 1 extension — spec agreed with Soham 7/16; item 4 done, rest not built)

Runs AFTER booking_confirmed, in this order. All modifications use getBooking (to fetch
`bookingSignature`) → modifyBooking. Sabre MCP exposes NO seat-map availability API — the
dashboard seat map is an illustrative cabin layout; the actual assignment via modifyBooking is
what's real. Ancillaries (extra bags, meals) are the exception: they must go into createBooking
itself (ATPCO only), so they're asked BEFORE booking, in flow step 7.

1. **Seats (voice + dashboard):** Miles asks "window or aisle?"; new client actions
   `show_seats` (render seat-map card) + `seat_selected`; apply via modifyBooking.
2. **Frequent flyer number:** ask once, add via the same modifyBooking call as seats.
3. **Passport/ID — ✂️ CUT (Soham, 7/17):** skipped for the hackathon. (Was: dashboard ID-photo
   upload → Claude-vision extract → modifyBooking identity docs. Revisit only if everything
   else ships.)
4. **Itinerary email (Zapier MCP) — ✅ WIRED AND VERIFIED 7/16 night.** Zapier MCP (Gmail
   authed, Soham's account) is attached as the second MCP server on the VB agent
   (`agents/mcp_servers.json`, gitignored — contains the Sabre bearer AND the Zapier token URL;
   pushing it REPLACES the whole MCP config, so sabre must always be in the file). Verified
   end-to-end with `vb mcp test`: list_enabled_zapier_actions → execute_zapier_write_action
   (Gmail action key `message`) → real email delivered in ~30s. Miles's prompt step 9 sends the
   itinerary right after booking_confirmed (only to the traveler's stated email; never blocks
   the call on failure). `vb mcp test "<query>"` runs a background MCP job without a voice call
   — the fastest way to test MCP chains.
5. **NO ticketing in Act 1** — PNR only; fulfillFlightTickets stays out of Miles's prompt
   (issue tickets manually before the Act 2 demo).

## Commands

Python is managed with **uv** (Python 3.12). No test suite or linter yet.

- **Run backend:** `uv run uvicorn api.main:app --reload` (port 8000; only needed for `/api/voice-token`)
- **Run frontend:** `cd frontend && npm run dev` (port 5173)
- **VB CLI:** `~/.local/bin/vb` (not on PATH in non-login shells)
  - `vb config show` — all agent settings at a glance
  - `vb config get <section>` — inspect `ai-agent`, `api-tools`, `client-actions`, `mcp-servers`, …
  - `vb config set --api-tools-file agents/api_tools.json` — push HTTP tools (currently just get_weather)
  - `vb config set --client-actions-file agents/client_actions.json` — push client actions
  - `vb config set --mcp-servers-file agents/mcp_servers.json` — push MCP servers (REPLACES all;
    file is gitignored, holds sabre bearer + zapier token URL)
  - `vb prompt set --file agents/miles_prompt.txt` — push system prompt
  - `vb mcp test "<query>"` — run a background MCP job WITHOUT a voice call (fastest MCP debug)
  - `vb logs` / `vb logs <session_id> --json` — transcripts INCLUDING tool calls (primary debug tool)
  - `vb debug` — live event stream (requires `--debug-mode true` on the agent first)
- Config changes take effect on the **next** call, not mid-call.

**Expected latencies:**
- Flight or hotel search via background query: **15–25s** (Miles speaks a filler line meanwhile)
- Booking commit: **60s+** — Miles must ask name/email first, then poll `check_query_status`.

## Architecture

```
agents/     VB config (source of truth): miles_prompt.txt, api_tools.json (get_weather only),
            client_actions.json (6 actions), mcp_servers.json (gitignored, sabre+zapier),
            api_tools_empty.json (utility for clearing)
frontend/   React: VocalBridgeProvider (App.tsx) → TripApp → VoicePanel + Dashboard +
            ItineraryPage + CheckoutPage; useTripActions listens to client actions
            Design tokens live in index.html <style> (:root CSS vars). Fonts: Bricolage
            Grotesque + DM Sans (Google Fonts). Components use inline styles referencing
            brand hex directly — no CSS modules, no Tailwind.
api/        FastAPI: /api/voice-token (ONLY live dependency); tools.py/state.py legacy for Act 1
sabre/      Legacy Python MCP client (_sabre_agent_run) — unused by Act 1, candidate for Act 2
contracts/  FROZEN — legacy reference only
```

### Key files

- `agents/miles_prompt.txt` — Miles system prompt: Sabre workflow rules, conversationId handoff,
  client-action payload templates, concierge behavior. THE most load-bearing file.
- `agents/client_actions.json` — 6 actions: leg_loading, show_flights, show_hotels,
  flight_selected, hotel_selected, booking_confirmed (+2 planned: show_seats, seat_selected —
  see Post-booking flow)
- `agents/api_tools.json` — get_weather (Open-Meteo)
- `frontend/src/hooks/useTripActions.ts` — subscribes to VB client actions via `useAgentActions`
- `frontend/src/App.tsx` — VocalBridgeProvider wrapper only (NO hooks, NO eager token fetch —
  an eager fetch here once spawned phantom VB agent sessions and broke connections)
- `frontend/src/TripApp.tsx` — inner component (all VB hooks live here)
- `api/routes/voice.py` — the token mint endpoint

### Rules that matter

- **VB is the orchestrator; Sabre MCP is attached to the VB agent directly.** No middle layer.
- **AI Agent mode stays OFF. Background AI stays ON.** (See lessons above.)
- **Dashboard renders from VB client actions — never from the transcript.**
- **Voice responses are prose only, 1–2 sentences.** Structured data goes to the dashboard.
- **offer_id/property_id must be copied verbatim** from Sabre responses into client actions and
  booking queries — and the Sabre `conversationId` must travel with them across background jobs.
- **No partial bookings.** The PNR is created once, after all selected legs are confirmed.
- **`useAgentActions` must be called inside `VocalBridgeProvider`** — hence App/TripApp split.
- **Never add an eager `/api/voice-token` fetch on page load** — each token mint dispatches a VB
  agent job; duplicates fight over the room.
- **`contracts/` is frozen.** Want to change it? Stop and ask a human.

## Secrets

`.env` at repo root (gitignored, never commit): `SABRE_MCP_URL`, `SABRE_MCP_SKILLS_URL`, `SABRE_TOKEN`
(⚠️ expires ~2026-07-20; also lives inside the VB dashboard MCP config — update BOTH), `SABRE_PCC`
(=S5OM — capital letter O, not zero), `VOCAL_BRIDGE_API_KEY`, `VB_AGENT_ID`
(=e1799708-ac1a-44fb-a6a5-6f20816b0a3b), `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE`
(sandbox). `ANTHROPIC_API_KEY` and `OPENWEATHER_API_KEY` were REMOVED (7/18) — nothing live uses
them; weather is keyless Open-Meteo and the only Claude caller is the dead legacy `sabre/client.py`.
PayPal is IN SCOPE for Act 1's checkout (sandbox orders API).
Zapier MCP (for the itinerary email): Soham's server URL comes from zapier.com/mcp — treat it
like a secret (it embeds the server id and grants Gmail send). Add as `ZAPIER_MCP_URL` in `.env`
when wiring it into the VB agent; never commit it.

## Repo note

The git root is this project folder (`~/Desktop/hackathon`), default branch `main`.
Never stage `.env` or `.claude/guides/sabre-developer-guide.txt` (contains the live token).
