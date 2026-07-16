# Voice-Native Trip Booking + Disruption Recovery — Technical Design Doc

**Hackathon:** Vocal Bridge × Sabre
**Team size:** 2
**Build window:** 8 hours (+ ~3 days pre-build, pending rules confirmation)
**Demo format:** Recorded, one video in two acts (assumed ~3:00 — confirm limit)

---

## 1. Scope & The Cut

### 1.1 What this is

Two halves of one product, sharing one brain:

**Act 1 — Book by voice (browser).** The user opens the app, talks, and books a
complete trip: flight, hotel, car. The dashboard populates live as they speak.
The flow ends in a **real Sabre booking (PNR)** — a confirmation number the user
hears and sees.

**Act 2 — Disruption recovery (phone, one call).** Days later the flight is
cancelled. The agent phones the traveler, replans the flight and every downstream
booking that just broke, gets approval at each step, puts the traveler on a brief
hold while it **phones the hotel for real**, comes back, confirms — all inside a
single call. The traveler hangs up once, with everything fixed.

The booking Act 2 disrupts is the booking Act 1 created. Same PNR, same session
lineage, same dashboard.

### 1.2 What we cut, and why

**Payments are IN (PayPal sandbox).** Reversed from the earlier cut: PayPal is a
hackathon partner with an agentic-commerce judge on the panel, and the hub
explicitly invites building against PayPal's APIs "to close the transaction
loop." Act 1 ends with confirm → **PayPal sandbox order create/capture** →
`commit_booking` (Sabre write). The frontend mock already has the checkout page
built. Use the PayPal Sandbox REST orders flow; surface the real sandbox order ID
as the transaction ID on screen.

**The callback branch.** The previous design let the traveler choose "call me
back" and had a third phone agent ring them when execution finished. Cut. The
disruption is now **one continuous call** (the hold branch): simpler build, one
fewer agent, one fewer spike, and the traveler audibly *hears* the hotel get
fixed — which is its own kind of proof. What we pay: the hotel negotiation plays
in real time and can't be compressed in the edit, so the front-desk script must be
tight (§7.3).

**Weather as a decision input.** Weather is decorative (§3.3).

### 1.3 Booking depth: Sabre write, DB fallback

Act 1 targets a **real sandbox booking** — the densest possible Sabre surface, and
"integrating both VB and Sabre" is a stated judging criterion. But whether the
Sabre MCP server exposes a create-booking/write tool is **unverified** (§8.2). So:

- **Phase 0 discovery task:** list the MCP tools, find the write path, create one
  booking by hand. Timebox: 45 minutes.
- **If the write tool exists:** `commit_booking` calls it; the PNR/confirmation ID
  flows back to the dashboard and the spoken close.
- **If it doesn't (or flakes):** `commit_booking` writes a confirmed itinerary to
  our own state store and mints a local confirmation code. On camera the two are
  identical. The seam (§6.3) means this is a one-function swap, decided once, not
  a fork in the architecture.

### 1.4 Cascade depth: Tier 3, bounded

Act 2 does **full re-availability and re-pricing** against live Sabre (Tier 3) —
not fixtures, not detect-and-tell. Cascade replanning is the densest Sabre surface
in the recovery flow, and fixtures only survive the script; real responses survive
retakes.

**Bounded at the sold-out branch.** If a hotel is unavailable on the new dates,
surface alternatives *from the search already run* and let the traveler pick. No
open-ended re-search. On camera the two look identical; in hours they're 1 vs 5.

### 1.5 Non-negotiable

`SABRE_MODE=live|fixture` behind a single tool module. The thing that makes Tier 3
survivable when the sandbox flakes at the venue. 30 minutes.

---

## 2. Architecture

### 2.1 The constraint that determined the split

Vocal Bridge has two ways for a voice agent to reach our backend, and they gate on
deploy target:

- **AI Agent mode** (delegate whole queries via the LiveKit data channel):
  **web only**, hard **60s** timeout per query.
- **Custom HTTP API tools** (the agent calls our REST endpoints directly): every
  deploy target, **1–300s** timeout per tool.

Act 1 is in a browser, so it uses **AI Agent mode**: the frontend relays each user
turn to `/agent/query` and speaks the reply. Every booking search must return
inside 60s — fine for single searches, and the flow is turn-by-turn anyway.

Act 2 is a phone call — no data channel — so the traveler agent reaches the same
backend through **HTTP tools**, with the 300s window that makes a nested hotel
call inside one tool invocation viable, and `--continuous-mode` so a 40-second
Sabre search isn't 40 seconds of dead air.

**Two mouths, one door:** both paths terminate at `/agent/query` (the web relay
posts it directly; the phone tools are thin wrappers that post into the same
graph). Nothing else reaches LangGraph.

### 2.2 Component inventory

```
  Browser (Act 1)                        PSTN (Act 2)
       │                                    │
       ▼                                    ▼
┌──────────────────┐      ┌─────────────────────┐   ┌──────────────────┐
│ VB planner agent │      │  VB traveler agent  │   │  VB hotel agent  │
│ web deploy,      │      │  prompt + HTTP      │   │  static prompt + │
│ AI Agent mode    │      │  tools, continuous  │   │  get_booking_ctx │
│ (60s)            │      │  mode, hold enabled │   └────────┬─────────┘
└────────┬─────────┘      └──────────┬──────────┘            │
         │ onQuery relay             │ HTTP tools (≤300s)    │ vb call ▲
         ▼                           ▼                       ▼         │
      ┌───────────────────────────────────────────────────────────────┐
      │                     FastAPI (Python)                          │
      │   /agent/query   /tools/*   /context/*   /events (SSE)        │
      └────────────────────────────┬──────────────────────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │    LangGraph     │──── Sabre MCP ──> sandbox
                          │  booking graph + │                  (search +
                          │  recovery graph  │──── vb call ────> outbound
                          │  thread_id =     │                   (hotel)
                          │  session_id      │
                          └────────┬─────────┘
                                   │
                            ┌──────▼──────┐          ┌──────────────┐
                            │ state store │──SSE────>│  Dashboard   │
                            │  (Postgres  │          │  (read-only  │
                            │   or dict)  │          │  spectator)  │
                            └─────────────┘          └──────────────┘
```

### 2.3 Two channels, one session

**Voice** is Vocal Bridge — browser WebRTC in Act 1, PSTN in Act 2. **UI state**
is our own SSE stream from FastAPI. They never touch.

This separation is not incidental — it's the reason the dashboard can't be broken
by VB. Every voice interaction hits FastAPI, so our backend always knows what's
happening and pushes to SSE. **The dashboard is the tool-call log, rendered
beautifully.** If voice drops mid-demo, the dashboard still tells the story.

In Act 1 the user glances at the dashboard while talking; in Act 2 they're on a
phone and the *camera* looks at it. Either way it is **read-only**: no click
handlers, no app→agent events. Strictly less work than an interactive one, and it
serves both acts unchanged.

### 2.4 Session identity

`thread_id = session_id` throughout. LangGraph's checkpointer keys on it; the
state store keys on it; the SSE stream filters on it; the web token endpoint
passes it explicitly.

Act 1 produces a persisted booking keyed by session/PNR. Act 2's disruption job
loads that booking — the continuity is the demo's connective tissue.

Outbound callee agents (the hotel) can't be handed context — see §4.3 — so they
**pull** it: a static prompt instructs them to call `get_booking_context` first,
and FastAPI returns the active slot. Key the slot by callee phone number if
concurrent sessions ever matter. For a scripted recording, they don't.

### 2.5 Frontend

React (whatever Claude Design exports; ask it for React + Tailwind). If the export
is static HTML, wrap it rather than rebuild it — 8 hours.

The frontend needs the VB SDK **only for Act 1**: `<VocalBridgeProvider>` +
`useAIAgent({ onQuery })` relaying to `/agent/query`, plus a token endpoint
(`/api/voice-token`) so the VB key stays server-side. For Act 2 the same page is
just an SSE subscriber.

---

## 3. Reasoning Split & Tool Inventory

### 3.1 The principle

The VB agents own **conversation**. LangGraph owns **consequence**.

Anything that costs money, changes a booking, or has to be defensible to a judge
runs in LangGraph and appears in the eval surface. Anything read-only, cheap, and
cosmetic can live on a VB agent as a direct HTTP tool, saving a round trip.

In Act 1 this split is structural: AI Agent mode delegates the *entire turn* to
`/agent/query`, so every booking decision is a LangGraph decision by construction.
In Act 2 it's a configuration choice, made per-tool below.

### 3.2 Ownership

**Act 1 (planner agent, web):** no per-tool config — `useAIAgent` relays every
domain turn to `/agent/query`. Inside the graph, the booking nodes are:
`understand`, `search_flights`, `search_hotels`, `search_cars`, `record_choice`,
`commit_booking` (the Sabre write, §1.3). All in the eval surface. The 60s AI
Agent timeout bounds each turn — one search per turn fits comfortably.

**Act 2 (traveler agent, phone):**

| Tool | Owner | Consequence | Timeout | In eval surface |
|---|---|---|---|---|
| `get_weather` | VB (HTTP tool → weather API) | none | 10s | no |
| `get_itinerary` | VB (HTTP tool → FastAPI, read-only) | none | 15s | no |
| `propose_recovery` | LangGraph | none (read) | 60s | **yes** |
| `search_flights` | LangGraph → Sabre | none (read) | 90s | **yes** |
| `record_choice` | LangGraph | state mutation | 30s | **yes** |
| `search_hotels` | LangGraph → Sabre | none (read) | 90s | **yes** |
| `search_cars` | LangGraph → Sabre | none (read) | 90s | **yes** |
| `call_hotel` | LangGraph → `vb call` | **outbound call** | 300s | **yes** |
| `commit_itinerary` | LangGraph → Sabre | **booking change** | 120s | **yes** |

Nine tools on the traveler agent, well under VB's limit of 20. The hotel agent
carries exactly one (`get_booking_context`). All URLs must be HTTPS — ngrok or a
deployed FastAPI, not localhost. If routing degrades, the first consolidation is
collapsing the three `search_*` tools into `search_inventory(leg_type)`.

`callback_traveler` is gone — the single-call design (§1.2) removed it.

### 3.3 Why weather sits on the VB side

Weather is **decorative** in this build. The agent mentions it while filling
("it's 82 and clear in Cancún on Sunday") and it never enters a booking or
replanning decision. That makes it safe to hand to the foreground agent directly.

**This inverts the moment weather becomes decisional.** If a storm ever drives an
itinerary change, weather must move into LangGraph — the VB foreground agent has
no access to itinerary state and cannot reason over it. Two agents with two views
of the world is the failure mode this split exists to avoid.

### 3.4 Routing risk

The phone-side VB agent decides, from its prompt, whether to answer itself or call
a tool. That routing is the main failure mode of this architecture: it will
occasionally answer confidently from its own knowledge instead of delegating.
(Act 1 has the same risk in a milder form — AI Agent mode's delegation is guided
by the agent description, and falls back to own-knowledge at the 60s timeout.)

Mitigations, in order of value:
1. Keep the VB-side tool surface tiny. Less to get wrong.
2. Prompt explicitly: never state a price, time, or availability that did not come
   from a tool result.
3. `vb debug` streams live events during test calls — watch tool selection directly
   rather than inferring it from transcripts.

### 3.5 Evaluation

`vb eval <session_id> --objective "..." --scenario "..."` sends the recording,
agent config, structured transcript with tool calls, and client-action log to a
multimodal evaluator. Limited to 100/day; recordings must be ≤18 MB.

Three objectives worth scoring:
- *"Booked a complete trip — flight, hotel, car — from voice alone."* — Act 1 works.
- *"Rebooked the traveler and resolved all downstream conflicts in one call."* — Act 2 works.
- *"Never took a consequential action without explicit approval."* — it behaves.

The third is the one worth putting on a slide. An agent that books things is a
demo; an agent that provably asks first is a product.

---

## 4. Voice Integration

Three VB agents, all created via `vb agent create`, each with a static prompt.

### 4.1 Planner agent (web, Act 1)

Deploy target web; AI Agent mode on:

```bash
vb config set --ai-agent-enabled true \
  --ai-agent-description "Travel booking agent with live flight, hotel and car \
inventory and the ability to create reservations. Delegate anything about \
availability, prices, dates, selections, or booking."
```

The `description` is what the foreground agent uses to decide when to delegate.
Vague description → it answers from its own knowledge and invents flight times
(§8.5). Be specific about what to hand over.

Frontend: `<VocalBridgeProvider>` + `useAIAgent({ onQuery })` → POST
`/agent/query` → returned prose is spoken automatically. Token minted server-side
at `/api/voice-token` with an explicit `session_id`.

Prompt constraints that matter:
- Never state a price, time, or availability that didn't come from the backend.
- Confirm explicitly before booking: read back flight + hotel + car + total, get a
  yes, only then relay the "book it" turn.

### 4.2 Traveler agent (outbound → PSTN, Act 2)

```bash
vb config set --outbound-enabled true --accept-outbound-tos \
              --continuous-mode true --continuous-mode-delay 3 \
              --hold-enabled true --hangup-enabled true \
              --api-tools-file traveler_tools.json \
              --debug-mode true
```

`--continuous-mode` is the load-bearing flag: the agent holds the floor and keeps
talking while tools run in the background. Without it, a 40-second Sabre call is
40 seconds of silence on a phone line, which reads as a dropped call.

`--hold-enabled` is now equally load-bearing: the nested hotel call plays out
while the traveler holds, inside one 300s `call_hotel` tool window.

Prompt constraints that matter:
- Never state a price, time, or availability that didn't come from a tool result.
- Never call a tool with a `call_` prefix without an explicit yes in the last turn.
- Before `call_hotel`, tell the traveler you're putting them on a brief hold.

### 4.3 Hotel agent (outbound → teammate's phone)

Static prompt: *"You are calling a hotel front desk to modify an existing booking.
Call `get_booking_context` first to learn which booking."* One HTTP tool.

Context is **pulled, not pushed**, because both documented push mechanisms are
web-path only (Client Actions need the data channel; token-endpoint injection
isn't in the PSTN dial path, and the token `context` field is undocumented —
§8.4). The callee agent asks our backend what it's calling about. One extra
endpoint, no undocumented fields.

The teammate plays the front desk. Give them a one-page script with two deviations
built in (a hold, and one clarifying question) — but **keep the total under ~25
seconds** (§7.3). A perfectly compliant front desk is the tell that it's staged; a
leisurely one kills the pacing now that the traveler is audibly holding.

### 4.4 Post-processing

Runs automatically after the traveler call ends. Prompt it to send the
confirmation email via a post-processing MCP server. This gets the email for free
rather than as a LangGraph node. (Optionally also on the Act 1 planner session —
a booking-confirmation email is a nice artifact, same mechanism.)

---

## 5. The Two Flows

### 5.0 Constraints recap

- Act 1 (web): AI Agent mode, data channel, **60s** per delegated turn.
- Act 2 (phone): HTTP tools, **300s** ceiling, `--continuous-mode` for dead air,
  `--hold-enabled` for the nested call.
- Both: LangGraph reached only via `/agent/query`; dashboard driven only by SSE.

### 5.1 Booking graph (Act 1)

```
understand            (parse intent: dates, origin, destination, party)
      │
      ▼
search_flights ───interrupt──> "four options — the 8:10 is cheapest"
      │                         (user picks; record_choice)
      ▼
search_hotels ────interrupt──> "three near the beach under $200"
      │
      ▼
search_cars ──────interrupt──> "mid-size, $31 a day, Hertz"
      │
      ▼
confirm ──────────interrupt──> reads back the full trip + total
      │
      ▼
commit_booking        (Sabre write → PNR; fallback: DB confirm — §1.3)
      │
      ▼
close                 (speech: confirmation code; SSE: all cards green)
```

Each `interrupt()` surfaces as the reply to `/agent/query`, which the planner
agent speaks. The user's next utterance arrives as the next query, resuming with
`Command(resume=...)`. Every search node writes to the state store and emits SSE
before the interrupt — the cards render *while* the agent talks about them.

The order is flexible in conversation (the user may ask for hotels first);
`understand` routes. Don't over-engineer this — the demo script drives one path.

### 5.2 Trigger (Act 2)

Off-camera POST to `/debug/cancel/{pnr}` marks the outbound leg cancelled and
enqueues a recovery job. (If the Sabre sandbox exposes a schedule-change event,
use it; the demo is identical and the credibility is higher. Do not spend more
than 30 minutes finding out.)

The job loads the Act 1 booking, computes the downstream conflict set (hotel
check-in, car pickup), and initiates `vb call` to the traveler.

**Dashboard:** flight card flips to CANCELLED red. Hotel and car cards go amber
with "conflict — arrival unknown." This happens *before the phone rings*, so the
viewer understands the stakes in the two seconds of ring tone.

### 5.3 Recovery graph (Act 2)

One node per leg, each gated by an `interrupt()`. The VB agent drives
conversation; LangGraph owns state and sequencing.

```
detect_disruption
      │
      ▼
propose_recovery      (no gate — folded into the agent's opening line)
      │
      ▼
replan_flight ────interrupt──> "the 6:05, or the 11:40?"
      │
      ▼
replan_hotel ─────interrupt──> "shorten to 2 nights — I'll call them?"
      │
      ▼
replan_car ───────interrupt──> "pickup Sunday noon?"
      │
      ▼
execute_inline        ("hold tight — calling the hotel now")
      │                 call_hotel (vb call, nested, ≤300s)
      ▼
commit_itinerary + email + dashboard final state
      │
      ▼
close                 ("all set — 2 nights, car at noon, it's in your inbox")
```

No hold-vs-callback gate: the single-call design executes inline, always. The
agent announces the hold rather than asking about it — the approvals already
happened at the three leg gates.

### 5.4 Approval gates

Three leg gates, in order: **flight → hotel → car**. Order matters — the flight
determines the constraint window for the other two, and the audience needs to see
the dominoes fall in causal order.

The agent presents a **recommendation plus one alternative** at each gate
("I'd put you on the 6:05 — or there's an 11:40 if you'd rather sleep in"). Full
option read-outs are more legible proof that Sabre is live but cost ~25s per gate;
the named alternative makes the point in a third of the time.

The nested hotel call happens **after** the hotel approval, never before. The
agent never picks up the phone on the user's behalf without a yes. This is the
defensibility story and it's worth one sentence in the demo narration.

### 5.5 Close

`commit_itinerary` writes final state. Dashboard settles into the new plan, all
cards green. Post-processing sends the confirmation email. The email is the
closing artifact, not the payoff — the payoff already happened on screen.

---

## 6. Sabre Surface

### 6.1 Access

Sabre is provided as an **MCP server**. VB agents can take MCP server URLs
directly, but we deliberately do **not** wire Sabre to any VB agent — Sabre calls
are consequential and belong in LangGraph (§3.1). LangGraph is the MCP client.

### 6.2 Tools used

| Purpose | Called by | Mode |
|---|---|---|
| Flight availability + fare | `search_flights` (both graphs) | read |
| Hotel availability + rate | `search_hotels` (both graphs) | read |
| Car availability + rate | `search_cars` (both graphs) | read |
| **Create booking / PNR** | `commit_booking` (Act 1) | **write** |
| Retrieve itinerary / PNR | `propose_recovery` (Act 2) | read |
| Rebook / modify | `commit_itinerary` (Act 2) | **write** |

Exact tool names to be filled from the MCP server's discovery response — do not
guess them from Sabre's public REST docs; the MCP surface may not match. **The
two write rows are the ones to verify first** (§1.3, §8.2): create-booking gates
Act 1's depth, modify gates Act 2's close.

### 6.3 The seam

Every Sabre call goes through one module:

```python
# sabre/client.py
SABRE_MODE = os.environ.get("SABRE_MODE", "live")  # live | fixture

async def search_flights(origin, dest, after_dt):
    if SABRE_MODE == "fixture":
        return _load("fixtures/flights_cun.json")
    return await _mcp.call("...", {...})
```

Fixtures are captured from **real sandbox responses**, not hand-written. Record
them during pre-build with a flag that dumps every live response to `fixtures/`.
Fixture mode replays reality rather than approximating it, and the two modes
can't drift in shape.

In fixture mode, `commit_booking` returns a canned PNR. The demo close is
identical.

30 minutes of work. It's the difference between a bad day and no demo.

### 6.4 What we don't know yet

Whether the sandbox (a) returns plausible inventory for a Cancún leisure
itinerary on the demo dates, (b) exposes a create-booking write tool, and (c) lets
a cancellation be triggered. All three are pre-build discovery tasks (§9, Phase 0).
If the sandbox is thin, pick a route it's rich on and rewrite the scenario — the
story doesn't depend on Cancún.

---

## 7. Demo Script & Cut Lines

**Budget: one video, two acts, ~3:00 total** (Act 1 ≈ 1:00, Act 2 ≈ 2:00).
**Confirm the hackathon's actual limit before storyboarding** — if it's 2:00
hard, Act 1 compresses to a ~30s montage (§7.4). Anything not in this script does
not get built.

### 7.1 Act 1 beat sheet — "Book it" (~1:00, browser)

| Time | Audio | Dashboard |
|---|---|---|
| 0:00–0:05 | "I want four days in Cancún, leaving Friday." | Flight card: loading. |
| 0:05–0:20 | "Four options — the 8:10am is cheapest at $284, or there's a nonstop at 10:30." / "The nonstop." | Options render; selection locks green. |
| 0:20–0:35 | "Hotels near the beach?" / "Something with a pool, under $200." / "The Fiesta Americana, $179." / "That one." | Hotel options → selected. |
| 0:35–0:45 | "And a mid-size car." / "Hertz, $31 a day, picked up at the airport." / "Perfect." | Car card fills. |
| 0:45–1:00 | "So: nonstop Friday 10:30, three nights at the Fiesta Americana, mid-size from Hertz — $612 all in. Book it?" / "Book it." / "Done — paid via PayPal, confirmation ABC123." | Checkout: PayPal sandbox pays, then everything green. PNR + sandbox txn ID on screen. |

*Editing note:* the searches can be jump-cut; the confirm + book beat plays
unbroken. The PNR on screen at 1:00 is the same PNR Act 2 disrupts — hold on it
for a beat.

### 7.2 Act 2 beat sheet — "The call" (~2:00, phone)

Title card between acts: *two days later.*

| Time | Audio | Dashboard |
|---|---|---|
| 0:00–0:12 | Ring tone | Flight card flips CANCELLED. Hotel + car go amber. |
| 0:12–0:25 | "Your 2pm to Cancún just got cancelled. I've already found a way through it — got a minute?" / "Yeah." | — |
| 0:25–0:45 | "I'd put you on the 6:05am — or there's an 11:40 if you'd rather sleep in." / "6:05." | Flight card → green. Hotel + car recompute against new arrival. |
| 0:45–1:00 | "That shortens the hotel to 2 nights. I'll need to call them — okay?" / "Go ahead." | Hotel card shows pending change. |
| 1:00–1:15 | "And I'll move the car to Sunday noon." / "Yep." | Car card → Sunday noon. |
| 1:15–1:20 | "Hold tight for a moment — I'm calling the hotel now." | — |
| 1:20–1:45 | Hotel negotiation, live, ducked under the visual (~25s, scripted tight). | Hotel call in progress. Transcript streaming live. Card resolves green. |
| 1:45–1:58 | "All sorted — 2 nights, car at noon, itinerary's in your inbox." | All cards green. New plan settled. |
| 1:58–2:00 | — | Email notification appears. |

### 7.3 The hold is the tightrope

The single-call design means the hotel negotiation plays in **real time** while
the traveler audibly waits — it can't be compressed in the edit without lying.
That's the price of cutting the callback, and it's manageable only if the
front-desk script is tight: one hold, one clarifying question, **under ~25
seconds total**. Rehearse it with a stopwatch. If it consistently runs long, the
cut is §7.4's hour-5 line, not a longer video.

What we get in exchange: the traveler (and the viewer) *hears* the fix happen
live on the same call — no cutaway, no trust-me. It's a different kind of proof
and arguably a stronger one.

### 7.4 Cut lines

- **Runtime limit is 2:00 hard?** Act 1 becomes a ~30s montage (three jump cuts +
  the "Book it → ABC123" beat unbroken), Act 2 trims the car gate.
- **Hour 3 — Sabre write tool missing/flaky?** `commit_booking` falls back to the
  DB confirm (§1.3). Decided once, no architecture change.
- **Hour 5 — nested hotel call unreliable or consistently >25s?** Cut it. The
  agent says "I've sorted the hotel" and the card goes green off a Sabre/DB
  write. Loses the best beat, keeps the cascade, still a coherent demo.
- **Hour 6 — anything still red?** `SABRE_MODE=fixture` and record. A working
  fixture demo beats a broken live one, and on camera at 30fps nobody can tell.

### 7.5 What the script is arguing

Act 1 argues competence: a complete trip, booked into a real GDS, from voice
alone. Act 2 argues the thesis: **the agent handled the things you didn't think
to ask about.** Nobody calls their travel agent about the car. The car is the
point.

The 4 seconds at Act 2 0:00 where two cards go amber before the phone even rings
is carrying that whole argument. Do not cut it.

---

## 8. Risks & Open Questions

Ordered by what kills the demo soonest.

### 8.1 Pre-build rules — UNRESOLVED

Two acts assume ~3 days of pre-build. Some hackathons require a fresh repo at
kickoff; some allow infra but not features. **If pre-building is barred, the
booking act shrinks to its happy path and the cascade falls back to Tier 2 with
fixtures.** Confirm with organizers before writing code.

### 8.2 Sabre sandbox behavior — UNRESOLVED, now gates Act 1 too

Three unknowns: usable inventory for the scenario, a **create-booking write
tool** (gates §1.3 — real PNR vs DB confirm), and a triggerable cancellation.
All are Phase 0 discovery. Timebox the cancellation question to 30 minutes and
the write-tool question to 45; fall back to `/debug/cancel/{pnr}` and the DB
confirm respectively, without regret.

### 8.3 The 60s web timeout

Act 1's AI Agent mode has a hard 60s per delegated turn, after which the voice
agent answers from its own knowledge — i.e., it *invents a booking response*.
Every booking-graph turn (one search, or the commit) must return well inside it.
If a Sabre search flirts with the limit, cache city/date pairs during rehearsal
or pre-warm at session start. Watch for this failure mode specifically in
`vb debug`: it is silent and looks fine on camera.

### 8.4 Token `context` field — UNVERIFIED

An assistant-sourced claim says `POST /api/v1/token` accepts a `context` field
that injects into the agent's system prompt. **Not in the documented request
body** (only `participant_name`, `session_id`). We don't depend on it — the hotel
agent pulls context (§4.3) — but verify before ever relying on it.

### 8.5 Foreground routing

A VB agent may answer from its own knowledge rather than delegating — inventing a
flight time, a price, an availability. The most likely *silent* failure: the demo
looks fine and the data is fabricated. Mitigations in §3.4. Watch `vb debug`
during every test call; do not infer tool use from transcripts.

### 8.6 Documented tier gates vs. observed behavior

The docs mark `vb call`, `vb agent create`, and `vb eval` as **Pilot only**. We
are on Developer tier and `vb call` rings, so the labels don't map cleanly. §4
needs *three* agents (planner, traveler, hotel) — confirm `vb agent create` ×3
specifically before building on it. `vb eval` is untested and only affects the
pitch, not the demo.

### 8.7 The hold length

§7.3. The nested hotel call plays in real time on the traveler's call. If the
front-desk performance can't reliably land under ~25s, take the hour-5 cut.

### 8.8 Concurrent sessions

The context slot (§2.4) is keyed per active session. Two overlapping demos would
clobber each other. Irrelevant for a recording; fatal in production. Noted so the
README doesn't oversell.

### 8.9 Deferred

- Eval dashboard: no room in the video. README or slide.
- Weather promoting from decorative to decisional (§3.3).
- Payments (§1.2).

---

## 9. Build Order

### 9.0 The ordering principle

**Sequence by risk retired per hour, not by architectural layer.**

LangGraph is the lowest-risk component in this build — the team has shipped it
repeatedly, and nothing about either graph is novel. It goes late.

The unknowns are all at the seams: does the browser relay reach our backend, does
a phone-deployed agent reach it, can a tool handler place a nested call and
survive, does the sandbox let us write a booking. Those get spiked first, with
everything behind them stubbed.

Rule: **nothing gets built properly until the thing it depends on has been proven
crudely.**

---

### Phase 0 — Non-code blockers (today, ~2h, do not skip)

| Task | Kills what if it fails |
|---|---|
| Confirm pre-build rules with organizers | Two-act scope → shrink per §8.1 |
| Confirm the demo video time limit | §7 budget → montage cut |
| `vb agent create` × 3 (planner, traveler, hotel) | §4 entirely — no fallback |
| Sabre MCP: list tools, run one live search | §6 — determines the scenario |
| Sabre MCP: find + exercise the **create-booking** tool | §1.3 → DB-confirm fallback |

**Lock the scenario to whatever the sandbox is rich on.** If Cancún is thin, pick
a route with real inventory and rewrite the dates. Doing this now costs 20
minutes; doing it at hour 4 costs the demo.

---

### Phase 1 — Spike: the web relay (~2h)

Act 1's thinnest end-to-end path. Everything stubbed.

1. FastAPI: `POST /agent/query` → `{"speech": "I found a 6:05am for $284."}`
2. `/api/voice-token` minting a VB token server-side with explicit `session_id`
3. Planner agent: `--ai-agent-enabled true` with a specific delegation description
4. Bare React page: `<VocalBridgeProvider>` + `useAIAgent` relay. Click Talk,
   speak, **hear the stub spoken back.**

Watch with `vb debug` from the first call, not the first bug. Gotchas: `connect()`
needs a user gesture; never call VB's API from the browser (CORS — always via the
token endpoint).

---

### Phase 2 — Spike: the phone relay (~1.5h)

1. Expose FastAPI over HTTPS (tunnel or deploy — VB requires HTTPS)
2. Traveler agent: one HTTP tool pointing at a stub, `--continuous-mode true`
3. `vb call` your own phone. Ask the question. **Hear the stub spoken back.**

---

### Phase 3 — Spike: the nested call (~2h)

The demo's best beat and its biggest unknown.

1. `POST /tools/call_hotel` → fire `vb call <teammate>` → block → return outcome
2. Hotel agent: static prompt + `get_booking_context` → verify the **pull** works
3. Confirm the 300s window holds, `--hold-enabled` behaves, and continuous mode
   covers the dead air — while *you* are the traveler, holding

Success = you're on the phone with the agent, it puts you on hold, you hear it
finish with your teammate, and it comes back to you. **That is the single-call
design proven.** No callback spike — there is no callback.

**After Phases 0–3 the demo is known to be possible.** Everything after is craft.

---

### Phase 4 — Contract freeze (~1h, both people, together)

Write and freeze:

- `contracts/agent_query.md` — the `/agent/query` request/response (Act 1's door)
- `contracts/tools.json` — the phone-side HTTP tools (§3.2): name, params, URL, timeout
- `contracts/sse_events.md` — the event schema the dashboard subscribes to

**These files are the seam between the two people.** Once frozen, both sides
build independently against stubs. Changing any requires telling the other person
out loud. Stub every endpoint to return fixture-shaped JSON immediately.

---

### Phase 5 — Parallel build

| | **Surface** | **Brain** |
|---|---|---|
| Owns | VB agents ×3, prompts, `tools.json` config, dashboard (React + SSE), Act 1 page, demo recording | Booking graph, recovery graph, Sabre client + seam, state store, FastAPI handlers, SSE emitter |
| Files | `agents/`, `frontend/` | `graph/`, `sabre/`, `api/` |
| Never touches | Python internals | VB config, React |

**Surface also plays the hotel front desk** (§4.3) and owns the recording.

Build order within Brain: state store → **booking graph** (Act 1, flights-only
vertical first, then hotels/cars/commit) → recovery graph skeleton with all
interrupts → cascade logic → `call_hotel` + `commit_itinerary` → seam + fixture
capture. Booking graph first: Act 2 disrupts what Act 1 creates, and the money
moment — speak, and real Sabre flights render while the agent talks — arrives
earliest on the web path.

Build order within Surface: planner prompt + Act 1 page → dashboard shell + SSE →
card states (build the amber `conflict` state now, Act 1 never triggers it but
Act 2 opens on it) → traveler/hotel prompts → polish.

---

### Phase 6 — Integration & recording (hackathon day, 8h)

| Hour | What |
|---|---|
| 0–0.5 | Smoke test. **Tunnel URL will have changed — `tools.json` needs updating.** Agents alive, keys valid, Sabre reachable. |
| 0.5–2.5 | Act 1 end to end: speak → book → PNR. First full run. |
| 2.5–4.5 | Act 2 end to end: cancel → call → cascade → nested call → close. |
| **3** | **Cut decision:** Sabre write working? If not → DB confirm (§7.4). |
| **5** | **Cut decision:** nested hotel call reliable and <25s? If not, cut it. |
| 5–6 | Capture fixtures from live responses (§6.3). Flip to `SABRE_MODE=fixture`, confirm both acts still run. |
| **6** | **Cut decision:** anything red → record on fixtures. |
| 6–8 | Record both acts. Retakes. README. |

If pre-build is allowed and Phases 0–5 land, hours 0–4.5 are integration and the
rest is retakes. That's the luxury the 3 days buys — not more features.

---

### 9.1 Taking this to Claude Code

- This doc lives in the repo (`.claude/guides/project-guide.md`). `CLAUDE.md`
  points at it and states the current phase.
- One Claude Code session per component, scoped to its directory. Sessions do not
  cross the Surface/Brain file boundary above — that's what causes merge pain.
- `contracts/` is frozen. If a session wants to change it, it stops and asks a human.
- Give each session the relevant sections, not the whole doc: Brain gets §2, §3,
  §5, §6. Surface gets §2, §4, §7.
- The cut lines in §7.4 are human decisions on a clock. Don't delegate them.
