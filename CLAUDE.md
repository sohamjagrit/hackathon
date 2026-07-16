This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A submission for the **DeepLearning.AI Voice AI Hackathon** (Sabre × Vocal Bridge, **July 18 2026**,
Mountain View): a voice-native travel agent with two acts sharing one brain.

- **Act 1 — Book by voice (browser):** the user talks (web mic, Vocal Bridge AI Agent mode), picks a
  flight and hotel, and the agent creates a **real Sabre booking (PNR)** while a read-only dashboard
  fills in live over SSE. Cars are **out of scope** — Sabre has no first-class car workflow tool.
- **Act 2 — Disruption recovery (phone, one call):** the flight is cancelled; the agent phones the
  traveler, replans flight → hotel with an approval gate at each step, puts the traveler on a brief
  hold while it places a **real nested phone call to the hotel**, then confirms — all in a single call.

**Read `.claude/guides/project-guide.md` (the DESIGN doc) before any architectural task.** Plain-language
version: `.claude/guides/project-summary.md`. Vendor refs: `.claude/guides/vb-developer-guide.md`,
`.claude/guides/sabre-developer-guide.txt`, and the Sabre skill guides in `.claude/sabre-skills/`.

## Current status (as of 2026-07-15)

**Phase 0 (blockers) — DONE:**
- ✅ **Sabre MCP verified live.** Tools confirmed: `SearchAndBookFlightWorkflow`,
  `SearchAndBookHotelWorkflow`, `FlightIssuedTicketManagementWorkflow`, `callSabreAPI`, plus OpenAPI-spec
  tools (`FlightShop`, `FlightReshop` ← Act 2 exchange path, `HotelsSearch`, `HotelPriceCheck`,
  `HotelRates`, `BookingManagement`). ⚠️ No first-class car tool — cars dropped from scope.
- ✅ All Python deps installed. `vb` CLI installed (`uv tool install vocal-bridge`).
- ✅ `.env` fully populated: `SABRE_TOKEN`, `SABRE_PCC=S5OM`, `VOCAL_BRIDGE_API_KEY`, `VB_AGENT_ID`,
  `ANTHROPIC_API_KEY`. ⚠️ Token expires ~2026-07-20; regenerate via hackathon portal if it dies.
- ✅ VB agent "Miles" (`e1799708-ac1a-44fb-a6a5-6f20816b0a3b`) verified live; AI Agent mode enabled.
- ✅ **`api/main.py` loads `.env` via `load_dotenv()` at startup** — this was a bug that caused
  `SABRE_TOKEN not set` errors; now fixed.
- ✅ **Live Sabre flight search verified:** real B6/AM flights MCO→CUN returned with offer IDs.
- ✅ **Live Sabre hotel search verified:** real Marriott properties with rates and amenities returned.

**Act 1 — WIRED, partially working:**
- ✅ **Contracts frozen:** `contracts/agent_query.md`, `contracts/sse_events.md`, `contracts/tools.json`
- ✅ **Backend:** `api/main.py`, `api/config.py`, `api/state.py`, all routes wired.
- ✅ **Sabre seam:** `sabre/client.py` — always hits live MCP via `_sabre_agent_run` (ReAct agent:
  Claude Haiku + Sabre MCP tools). No fixture mode. Set `CAPTURE=1` to dump to `sabre/captures/`.
- ✅ **LangGraph graph:** `graph/nodes.py` + `graph/build.py` with interrupt pattern per step.
- ✅ **Frontend:** Vite + React-TS with SSE-driven cards, option rows, itinerary page, checkout page.
- ⚠️ **Cars removed from UI and graph** (to be done — see Issues below).
- ⚠️ **Parallel search not yet implemented** (to be done — see Issues below).
- ⚠️ **MCP observability not yet implemented** (to be done — see Issues below).

**Open issues / next tasks (in priority order):**

1. **Remove car rental from graph and UI** — `search_and_pick_car` node, `TripCard` car card,
   and all car state should be deleted. Cars are not supported by Sabre's workflow tools.

2. **Parallel flight + hotel search** — Once Miles has origin, destination, and dates, fire
   `search_flights` and `search_hotels` concurrently (asyncio gather). Hotel check-in = depart_date,
   check-out = return_date (Miles asks the user for dates before searching, not before the hotel step).
   Both cards should fill in at the same time on the dashboard.

3. **Booking commit order** — Search is parallel, but SELECTION and COMMIT are sequential:
   - User must explicitly pick a flight before hotel selection begins.
   - If user says "skip flights" (no flight needed), we can proceed to hotel.
   - The actual Sabre PNR is created in a single combined call after BOTH flight and hotel are selected
     and the user says confirm. Never commit partial bookings.

4. **MCP observability** — Every `_sabre_agent_run` call should log to:
   - **Terminal:** structured table printed to stdout — columns: timestamp, tool_name, input_summary,
     output_summary, duration_ms.
   - **File:** `sabre/logs/mcp_calls.log` (newline-delimited JSON, one entry per tool call).
   - Use a LangChain callback handler on the agent to intercept tool calls + results.

5. **Airline names** — Add full airline name to the flight search prompt so the MCP agent returns it.
   Ask the agent to include `"airline_name": "<Full Airline Name>"` in each flight option JSON.
   Display it in `TripCard` flight rows and the `ItineraryPage` instead of just carrier code.

6. **Flight card visual improvement** — Show airline name, not just carrier code. Show departure city
   name (not just IATA code) in the itinerary page header.

**Next up — Act 2 (after Act 1 issues are resolved):**
- Create `traveler` and `hotel` VB agents
- Build recovery graph (`graph/recovery.py`): cancelled flight → replan flight/hotel → approval gates → nested hotel call
- Wire `/debug/cancel/{pnr}` to launch `vb call` + recovery graph
- Act 2 phone tool endpoints (need ngrok HTTPS URL in tool definitions)

## Commands

Python is managed with **uv** (Python 3.12). No test suite or linter yet.

- **Run backend:** `uv run uvicorn api.main:app --reload` (port 8000; `.env` auto-loaded by `load_dotenv()` in `api/main.py`)
- **Run frontend:** `cd frontend && npm run dev` (port 5173; deps already installed)
- **ngrok tunnel:** `ngrok http 8000` → public HTTPS URL for Act 2 phone tool endpoints
- **VB CLI:** `~/.local/bin/vb` (not on PATH in non-login shells); `vb debug` streams live events
- **MCP call debug:** set `CAPTURE=1` env var — dumps raw normalized responses to `sabre/captures/`
- **Quick Sabre MCP smoke test:** POST JSON-RPC `initialize` then `tools/list` to `$SABRE_MCP_URL`
  with `Authorization: Bearer $SABRE_TOKEN` and `Accept: application/json, text/event-stream`.

**Expected latencies (live MCP):**
- Flight or hotel search: **15–25s** (agent does spec-load → callSabreAPI → format)
- Booking commit: **30–60s** (SearchAndBookFlightWorkflow + hotel)
- VB AI Agent mode hard timeout: **60s** — Miles must respond within this window or VB fabricates.
  For booking, Miles should say "booking now, give me a moment" to set expectations.

## Architecture

```
api/        BRAIN — FastAPI: /agent/query (the one door), /api/voice-token, /events (SSE), state store
graph/      BRAIN — LangGraph: booking graph (Act 1, flight+hotel only) + recovery graph (Act 2)
sabre/      BRAIN — MCP client (always live, _sabre_agent_run); logs to sabre/logs/ when CAPTURE=1
agents/     SURFACE — VB agent prompts/config (planner, traveler, hotel), versioned
frontend/   SURFACE — React: voice panel + SSE dashboard + itinerary page + checkout page
contracts/  FROZEN — agent_query.md, tools.json, sse_events.md
```

### Rules that matter

- **`/agent/query` is the ONLY entry point into LangGraph.** Act 2's phone path depends on this.
- **`contracts/` is frozen.** Want to change it? Stop and ask a human.
- **The dashboard renders graph state via SSE — never from the transcript.** Read-only in both acts.
- **All Sabre calls go through `sabre/client.py`.** Never call MCP directly from nodes.
- **Voice responses are prose only.** Structured data goes to the dashboard, never into speech.
- **Search is parallel, selection and commit are sequential.** Fire flight+hotel search together once
  we have dates. But never commit hotel until flight is selected (or explicitly skipped by the user).
- **No partial bookings.** The Sabre PNR is created once, after both flight and hotel are confirmed.
- **60s hard timeout** on VB AI Agent turns. Phone HTTP tools get 300s. All VB tool URLs must be HTTPS.
- **Cars are out of scope.** Do not add car search/booking. Sabre has no first-class car workflow tool.
- **Session boundaries:** Brain (`api/`, `graph/`, `sabre/`); Surface (`agents/`, `frontend/`).

## Secrets

`.env` at repo root (gitignored, never commit): `SABRE_MCP_URL`, `SABRE_MCP_SKILLS_URL`, `SABRE_TOKEN`,
`SABRE_PCC` (=S5OM — capital letter O, not zero), `VOCAL_BRIDGE_API_KEY`, `VB_AGENT_ID`,
`ANTHROPIC_API_KEY`, `OPENWEATHER_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE`
(sandbox). PayPal is IN SCOPE for Act 1's checkout (sandbox orders API).

## Repo note

The git root is this project folder (`~/Desktop/hackathon`), default branch `main`.
Never stage `.env` or `.claude/guides/sabre-developer-guide.txt` (contains the live token).
