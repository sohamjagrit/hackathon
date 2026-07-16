# Phase 1 Setup — Book as you talk (Act 1)

Web path. Browser + microphone. No phones.

This is no longer just scaffolding — **Phase 1 is Act 1 of the demo**: the user
books a complete trip (flight, hotel, car) by voice, ending in a real Sabre
booking (PNR), with the dashboard filling in live. Read §2 and §5.1 of
`project-guide.md` before starting. Everything here still serves one rule:
**one backend, two voice front-ends.** Act 2 (the phone path) swaps the mouth,
nothing else — and it disrupts the booking this phase creates.

---

## Step 0 — Blockers (~2h, today, before any code)

```bash
pip install vocal-bridge       # already installed via `uv tool install vocal-bridge`
vb auth login vb_your_key
vb agent                       # confirm you're authenticated
```

Four questions, all yes/no:

1. **Are we allowed to pre-build?** Email the organizers. Also confirm the demo
   video time limit — it decides whether Act 1 gets ~60s or a 30s montage (§7.4).
2. **Can you create agents?** We need three (planner, traveler, hotel):
   ```bash
   vb agent create --name "Trip Planner"
   ```
3. **Does Sabre's sandbox have real inventory for the scenario?** Connect to the
   MCP server, list tools, run one flight search. **If Cancún is thin, change the
   city now.** The story doesn't care. Hour 4 does.
4. **Does the Sabre MCP expose a create-booking / write tool?** Find it and create
   one booking by hand (timebox: 45 min). Yes → `commit_booking` writes a real
   PNR. No → DB-confirmed itinerary fallback (§1.3). Decide once, today.

Do not proceed until all four are answered.

---

## Step 1 — Repo skeleton (20 min)

```
trip-agent/
├── CLAUDE.md              # points at project-guide.md, states current phase
├── contracts/             # FROZEN — see §9 Phase 4
│   ├── agent_query.md
│   └── sse_events.md
├── api/                   # BRAIN — FastAPI
│   ├── main.py
│   ├── routes/
│   │   ├── voice.py       # /api/voice-token
│   │   ├── agent.py       # /agent/query   ← the one door
│   │   └── events.py      # /events        ← SSE
│   └── state.py
├── graph/                 # BRAIN — LangGraph
│   ├── build.py           # booking graph now; recovery graph joins in Act 2 work
│   └── nodes/
├── sabre/                 # BRAIN — MCP client + seam
│   ├── client.py
│   └── fixtures/
├── agents/                # SURFACE — VB config, versioned
│   ├── planner_prompt.txt
│   └── client_actions.json
└── frontend/              # SURFACE — React
    └── src/
```

```bash
uv add fastapi uvicorn langgraph langchain-mcp-adapters sse-starlette httpx
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install @vocalbridgeai/sdk @vocalbridgeai/react && cd ..
```

`.env`:
```
VOCAL_BRIDGE_API_KEY=vb_...
VB_AGENT_ID=...            # the planner agent (web)
SABRE_MCP_URL=...
SABRE_MODE=live
ANTHROPIC_API_KEY=...
```

---

## Step 2 — Contract freeze (1h, both people, together)

**Do this before writing a line of either side.** It's the seam between you.

`contracts/agent_query.md`:
```json
// POST /agent/query
{ "session_id": "abc123", "query": "I want four days in Cancún, leaving Friday" }

// 200
{ "speech": "I found four flights out of Orlando Friday morning..." }
```

Note what's **not** in the response: the options. Those go to the dashboard over
SSE, not through the voice layer. The voice agent gets prose to speak; the UI gets
structured state. This split is deliberate — see §2.3.

`contracts/sse_events.md`:
```json
// GET /events?session_id=abc123  (text/event-stream)
{ "type": "flight_options", "session_id": "abc123",
  "payload": { "options": [ { "id": "f1", "carrier": "DL", "depart": "...",
                              "arrive": "...", "price": 284 } ] } }
{ "type": "leg_status", "session_id": "abc123",
  "payload": { "leg": "hotel", "status": "selected" } }
{ "type": "booking_confirmed", "session_id": "abc123",
  "payload": { "pnr": "ABC123", "total": 612 } }
```

Freeze both. Changing either now requires saying so out loud to the other person.

---

## Step 3 — Spike the relay (2h) ⚠️ THE IMPORTANT ONE

The thinnest end-to-end path. Everything stubbed. This proves §2.1's web half.

**3a. Token endpoint** (`api/routes/voice.py`):
```python
@router.post("/api/voice-token")
async def voice_token(body: dict):
    async with httpx.AsyncClient() as c:
        r = await c.post(
            "https://vocalbridgeai.com/api/v1/token",
            headers={"X-API-Key": os.environ["VOCAL_BRIDGE_API_KEY"],
                     "X-Agent-Id": os.environ["VB_AGENT_ID"]},
            json={"participant_name": body.get("participant_name", "User"),
                  "session_id": body["session_id"]},
        )
        return r.json()
```

Pass `session_id` explicitly — it's how the dashboard, the graph, and the voice
session agree on who they're talking about. This is the thread that ties everything,
and in Act 2 it's how the disruption job finds the booking.

**3b. The one door** (`api/routes/agent.py`):
```python
@router.post("/agent/query")
async def agent_query(body: dict):
    return {"speech": "I found a 6:05am out of Orlando for $284."}   # stub
```

**3c. Enable AI Agent mode:**
```bash
vb config set --ai-agent-enabled true \
  --ai-agent-description "Travel booking agent with live flight, hotel and car inventory and the ability to create reservations. Delegate anything about availability, prices, dates, selections, or the booking."
```

The `description` is what the foreground agent uses to decide when to delegate.
Vague description → it answers from its own knowledge and invents flight times
(§8.5). Be specific about what to hand over.

**3d. Frontend:**
```tsx
<VocalBridgeProvider options={{ auth: { tokenUrl: '/api/voice-token' } }}>
  <Planner />
</VocalBridgeProvider>

function Planner() {
  const { state, connect } = useVocalBridge();
  const { transcript } = useTranscript();

  useAIAgent({
    onQuery: async (query) => {
      const r = await fetch('/agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, query }),
      });
      return (await r.json()).speech;   // returned value is spoken automatically
    },
  });

  return <button onClick={connect}>Talk</button>;
}
```

**3e. Test.** Click, speak, **hear the stub spoken back.**

That's the whole Act 1 architecture. If it works, everything downstream is known
work. If it doesn't, nothing else matters yet.

> **Watch it with `vb debug` in a second terminal from the first call**, not from
> the first bug. You want to see tool selection directly, not infer it from
> transcripts.

**Gotchas:**
- `connect()` must be called from a user gesture (browsers block autoplay audio).
- Don't call VB's API from the browser — CORS. Always via your token endpoint.
- AI Agent mode has a hard **60s timeout**, then the voice agent answers from its
  own knowledge — i.e. it *invents a booking response* (§8.3). Every Sabre search
  and the commit must come back inside it. (Act 2's HTTP tools get 300s — one of
  the few things the phone path does better.)

---

## Step 4 — SSE + dashboard shell (3h)

**Before LangGraph.** It's the visual payoff of both acts and Act 2 inherits it
unchanged.

**4a. State store** (`api/state.py`) — a dict keyed by `session_id` is fine for
dev, but bookings must survive between Act 1 and Act 2 — persist confirmed
itineraries (SQLite/Postgres or a JSON file; anything that outlives a restart).

**4b. SSE emitter** (`api/routes/events.py`) — `sse-starlette`, filter by
`session_id`, push on every state write.

**4c. Debug endpoint:** `POST /debug/emit` that shoves an arbitrary event onto the
stream. This is how you build the whole dashboard with no graph and no Sabre.

**4d. Dashboard:** subscribe with `EventSource`. Render cards from state. Nothing
else. No click handlers — **the dashboard is read-only in both acts** (§2.3).

```tsx
useEffect(() => {
  const es = new EventSource(`/events?session_id=${SESSION_ID}`);
  es.onmessage = (e) => applyEvent(JSON.parse(e.data));
  return () => es.close();
}, []);
```

Card states you'll need across both acts: `empty → loading → options → selected →
confirmed`, plus `conflict` (amber) and `cancelled` (red), which only Act 2
triggers. Build amber and red now even though Act 1 never shows them. It's ten
minutes now and a context-switch later.

**Exit:** `curl` the debug endpoint, watch a flight card appear. No voice involved.

---

## Step 5 — Sabre client + seam (3h)

**One vertical. Flights only.** Do not add hotels until flights work end to end.

`sabre/client.py`:
```python
SABRE_MODE = os.environ.get("SABRE_MODE", "live")

async def search_flights(origin, dest, date):
    if SABRE_MODE == "fixture":
        return _load("fixtures/flights.json")
    result = await _mcp.call("...", {...})
    if os.environ.get("CAPTURE"):
        _dump("fixtures/flights.json", result)   # capture reality, don't write it
    return result
```

The `CAPTURE` flag matters (§6.3): fixtures recorded from live responses replay
reality and can't drift in shape from live mode. Hand-written fixtures lie.

Run every search once with `CAPTURE=1` during Phase 1. By the hackathon you have a
full fixture set for free.

While you're in here: wrap the **create-booking tool** you found in Step 0 the
same way (`create_booking(...)`, fixture mode returns a canned PNR). If Step 0
said no write tool exists, this function writes to the state store and mints a
local confirmation code instead — same signature, callers never know (§1.3).

---

## Step 6 — LangGraph: the booking graph (4h)

Behind `/agent/query`. Flights only, still.

```python
# graph/build.py
graph = StateGraph(TripState)
graph.add_node("understand", understand)          # parse intent from the query
graph.add_node("search_flights", search_flights_node)
graph.add_node("record_choice", record_choice)    # user picked; lock it in state
graph.add_node("respond", respond)                # → {"speech": ...}
```

Two rules that carry into Act 2:

1. **Every node that produces options writes to the state store and emits SSE.**
   The dashboard is a projection of graph state, never of the transcript.
2. **`respond` returns prose only.** Never serialize options into speech — that's
   what the dashboard is for. The agent says "I found four options, cheapest is
   $284" while the cards render.

`thread_id = session_id` in the checkpointer. Same key as the token endpoint, same
key as SSE. Selections are `interrupt()`s: the reply to `/agent/query` is the
question, the user's next utterance resumes with `Command(resume=...)`.

**Exit — the money moment:** speak into the browser, and real Sabre flights appear
on the dashboard while the agent talks about them.

**Get this with one vertical before adding the other two.** If it works for flights,
hotels and cars are copy-paste. If it doesn't, you've saved yourself debugging it
three times.

---

## Step 7 — Hotels, cars, confirm, book (4h)

Now copy-paste: add `search_hotels`, `search_cars`, each with its selection
interrupt. Then the two nodes that end Act 1:

- **`confirm`** — reads back the whole trip (flight + hotel + car + total) as one
  interrupt. The agent must get an explicit yes before booking. This gate is part
  of the pitch ("provably asks first") — don't optimize it away.
- **`commit_booking`** — calls `sabre.create_booking(...)` (or the DB fallback).
  Persists the confirmed itinerary keyed by session/PNR, emits
  `booking_confirmed` over SSE, returns the confirmation code in the speech.

**Payment is in scope (§1.2):** between `confirm` and `commit_booking`, run the
PayPal **sandbox** order create/capture (REST orders API — needs PayPal sandbox
client ID/secret in `.env`) and surface the real sandbox order ID as the txn ID.
Phase 1 ends at a **paid, booked trip with a confirmation number** — the artifact
Act 2 disrupts.

---

## Phase 1 exit criteria

Do not start the Act 2 (phone) work until all five are true:

- [ ] Speak → real Sabre options appear on the dashboard
- [ ] "Book it" → PNR (or fallback confirmation) spoken, shown, and **persisted**
- [ ] The persisted booking is retrievable by session/PNR (Act 2's entry point)
- [ ] `SABRE_MODE=fixture` runs the same flow with no network
- [ ] **`/agent/query` is the only door into LangGraph** ← the one that matters

The fifth is what makes the phone path an afternoon instead of a rebuild. If
anything else has grown its own path into the graph, fix it before moving on.

---

## Suggested CLAUDE.md

```md
# Trip Agent

Read .claude/guides/project-guide.md before any task. We are in **Phase 1 /
Act 1: voice booking** (see §9).

## Rules
- `/agent/query` is the ONLY entry point into LangGraph. Act 2 depends on this.
- `contracts/` is frozen. Want to change it? Stop and ask.
- The dashboard renders graph state via SSE. Never from the transcript.
- All Sabre calls go through `sabre/client.py`. Never call MCP directly.
- Voice responses are prose. Structured data goes to the dashboard, never to speech.
- `commit_booking` must get an explicit user yes (the `confirm` interrupt) first.

## Boundaries
- Brain session: `api/`, `graph/`, `sabre/`
- Surface session: `agents/`, `frontend/`
- Sessions do not cross this line.
```
