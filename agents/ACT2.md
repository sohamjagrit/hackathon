# Act 2 — Disruption recovery (detailed operator guide)

Phone path: traveler agent (outbound) + hotel agent (nested call) + minimal FastAPI.
Code is already wired. This doc is the **runbook** to go from zero → ringing phones.

---

## Architecture (what talks to what)

```
You (curl /debug/cancel)
        │
        ▼
FastAPI ──SSE──► Dashboard (browser, camera)
        │
        ├── vb call TRAVELER_PHONE ──► Traveler Recovery agent
        │                                  │
        │                                  ├── HTTP get_itinerary ──► FastAPI
        │                                  ├── Sabre MCP (reshop / modify)
        │                                  └── HTTP call_hotel ──► FastAPI
        │                                                            │
        │                                                            ├── SSE hotel_call_status
        │                                                            └── vb call HOTEL_PHONE
        │                                                                      │
        │                                                                      ▼
        │                                                            Hotel Front Desk agent
        │                                                                      │
        │                                                                      └── GET /context/hotel_call
        └── (on hotel call success) SSE recovery_confirmed
```

**Rules that matter**
- Traveler: Background AI **ON**, AI Agent mode **OFF**, Sabre MCP attached.
- Hotel: **no** Sabre MCP; only `get_booking_context`.
- HTTP tool URLs must be **HTTPS** pointing at your tunnel (not localhost).
- Free ngrok interstitial page breaks VB HTTP tools — use Cloudflare Tunnel or paid ngrok.

---

## Checklist (do in order)

| # | Step | Done when |
|---|------|-----------|
| 1 | Fill phones in `.env` | `TRAVELER_PHONE` + `HOTEL_PHONE` are E.164 |
| 2 | Start FastAPI + frontend | `:8000/health` and `:5173` load |
| 3 | Start HTTPS tunnel → `:8000` | External `https://…/health` returns `{"ok":true}` |
| 4 | Set `PUBLIC_BASE_URL` | Matches tunnel URL, no trailing slash |
| 5 | Run `./agents/setup_act2.sh` | Both agent IDs written into `.env` |
| 6 | Run `./agents/check_act2.sh` | All checks OK |
| 7 | Persist a booking | `/debug/booking/{session}` shows a PNR |
| 8 | Open dashboard on that session | Cards visible |
| 9 | `curl …/debug/cancel/{pnr}` | Traveler phone rings |

---

## Step 1 — Phones in `.env`

Open `.env` and set:

```bash
TRAVELER_PHONE=+1XXXXXXXXXX   # phone YOU will answer as the traveler
HOTEL_PHONE=+1YYYYYYYYYY      # teammate phone playing hotel front desk
```

Must be **E.164** (`+` then country code, no spaces/dashes).
Example: `+14155551234`.

Leave `PUBLIC_BASE_URL` and agent IDs empty until steps 3–5.

---

## Step 2 — Local servers

**Terminal 1 — FastAPI**
```bash
cd ~/Desktop/hackathon
uv run uvicorn api.main:app --reload --port 8000
```
Verify: `curl http://localhost:8000/health` → `{"ok":true}`

**Terminal 2 — frontend**
```bash
cd ~/Desktop/hackathon/frontend
npm run dev
```
Open `http://localhost:5173`.

Leave both running for the whole demo.

---

## Step 3 — HTTPS tunnel (detailed)

VB agents call your tools from the **cloud**. They cannot hit `localhost:8000`.
You need a public HTTPS URL that forwards to FastAPI.

### Option A — Cloudflare Tunnel (recommended)

```bash
brew install cloudflared
cloudflared tunnel --url http://localhost:8000
```

You’ll see something like:
```
https://random-words-1234.trycloudflare.com
```

That URL **is** your `PUBLIC_BASE_URL`.

**Every time you restart cloudflared, the URL changes.** Then you must:
1. Update `PUBLIC_BASE_URL` in `.env`
2. Re-run `./agents/patch_act2_tools.sh` (or `setup_act2.sh`)
3. Re-push api-tools to both agents (setup script does this)

### Option B — ngrok

You have `ngrok` installed.

```bash
ngrok http 8000
```

Copy the `https://….ngrok-free.app` (or `ngrok.app`) URL.

**Warning:** free ngrok often shows an interstitial HTML page to bots.
Vocal Bridge HTTP tools then get HTML instead of JSON → Miles/traveler “technical glitch”.
If tools fail with weird HTML errors, switch to Cloudflare Tunnel or a paid ngrok plan.

### Verify the tunnel

```bash
export PUBLIC_BASE_URL=https://YOUR-TUNNEL-HOST   # no trailing slash
curl "$PUBLIC_BASE_URL/health"
curl -X POST "$PUBLIC_BASE_URL/tools/get_itinerary" \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"active"}'
```

Both must return JSON (not an HTML warning page).

Paste into `.env`:
```bash
PUBLIC_BASE_URL=https://YOUR-TUNNEL-HOST
```

---

## Step 4 — Create & configure VB agents

One command does create + config + writes IDs into `.env`:

```bash
cd ~/Desktop/hackathon
# ensure .env has PUBLIC_BASE_URL from step 3
./agents/setup_act2.sh
```

What it does:
1. Patches `traveler_tools.json` / `hotel_tools.json` with `PUBLIC_BASE_URL`
2. Creates **Traveler Recovery** (or reuses if it exists)
3. Sets on traveler:
   - `--outbound-enabled true --accept-outbound-tos`
   - `--continuous-mode true --continuous-mode-delay 3`
   - `--hold-enabled true --hangup-enabled true`
   - `--background-enabled true --debug-mode true`
   - Sabre+Zapier MCP from `agents/mcp_servers.json`
   - patched HTTP tools + `traveler_prompt.txt`
4. Creates **Hotel Front Desk** (or reuses)
5. Sets outbound + hotel tools/prompt (no Sabre MCP)
6. Restores **Miles** as the selected agent (Act 1 web unbroken)
7. Writes `VB_TRAVELER_AGENT_ID` / `VB_HOTEL_AGENT_ID` into `.env`

### Manual equivalent (if you prefer)

```bash
export PUBLIC_BASE_URL=https://YOUR-TUNNEL-HOST
./agents/patch_act2_tools.sh
# outputs under $TMPDIR/miles-act2-tools/

vb agent create --name "Traveler Recovery" --style Chatty --deploy-targets phone \
  --hold-enabled true --hangup-enabled true --debug-mode true \
  --background-enabled true \
  --prompt-file agents/traveler_prompt.txt \
  --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/traveler_tools.json" \
  --json
# → copy id into VB_TRAVELER_AGENT_ID

vb agent use $VB_TRAVELER_AGENT_ID
vb config set --outbound-enabled true --accept-outbound-tos \
  --continuous-mode true --continuous-mode-delay 3 \
  --hold-enabled true --hangup-enabled true \
  --background-enabled true --debug-mode true \
  --mcp-servers-file agents/mcp_servers.json \
  --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/traveler_tools.json" \
  --prompt-file agents/traveler_prompt.txt

vb agent create --name "Hotel Front Desk" --style Focused --deploy-targets phone \
  --prompt-file agents/hotel_prompt.txt \
  --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/hotel_tools.json" \
  --json
# → copy id into VB_HOTEL_AGENT_ID

vb agent use $VB_HOTEL_AGENT_ID
vb config set --outbound-enabled true --accept-outbound-tos \
  --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/hotel_tools.json" \
  --prompt-file agents/hotel_prompt.txt

# Restore Miles for Act 1
vb agent use $VB_AGENT_ID
```

### Verify agent config

```bash
vb agent list

vb agent use $VB_TRAVELER_AGENT_ID
vb config show
# Expect: phone deploy, hold+hangup, continuous_mode, background, MCP sabre, tools get_itinerary+call_hotel
# AI Agent / external agent must be OFF

vb agent use $VB_HOTEL_AGENT_ID
vb config show
# Expect: get_booking_context only, outbound on, no need for Sabre MCP

vb agent use $VB_AGENT_ID   # back to Miles
```

**Important:** `vb config set --mcp-servers-file` **replaces** the whole MCP list.
Always push from `agents/mcp_servers.json` (has Sabre + Zapier). Never push an empty file.

Config changes apply on the **next** call, not mid-call.

---

## Step 5 — Readiness check

```bash
./agents/check_act2.sh
```

Fix any FAIL lines before continuing.

---

## Step 6 — Have a booking to disrupt

### Preferred: finish Act 1
1. `http://localhost:5173` → talk to Miles → book → get a PNR
2. Frontend auto-POSTs `/debug/persist-booking`
3. Note the `session_id` in the dashboard status bar (first 8 chars shown)

### Or seed without booking
```bash
curl -X POST http://localhost:8000/debug/persist-booking \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id": "smoke-002",
    "pnr": "7HZK70",
    "flight": {
      "flight_number": "AA2121",
      "origin": "MCO",
      "destination": "CUN",
      "detail": "AA2121 MCO→CUN 8:10am"
    },
    "hotel": {
      "name": "Fiesta Americana Coral Beach",
      "check_in": "2026-07-17",
      "check_out": "2026-07-21",
      "nights": 4
    },
    "traveler_name": "Test Traveler"
  }'
```

Confirm:
```bash
curl http://localhost:8000/debug/booking/smoke-002
```

For seeded smoke: open the app such that SSE uses `smoke-002`, **or** after cancel the camera watches whatever session you hydrated. Easiest demo path is Act 1 then cancel that PNR on the same open tab.

---

## Step 7 — Spectator dashboard

1. Keep the browser tab with the booking open (camera points here).
2. SSE is already connected via `useSSE(sessionId)`.
3. You should see confirmed flight + hotel cards (or hydrated from booking).

---

## Step 8 — Trigger Act 2

Off-camera (or cutaway):

```bash
curl -X POST http://localhost:8000/debug/cancel/7HZK70
# replace PNR with your real one
```

Expected response:
```json
{"ok": true, "session_id": "...", "pnr": "...", "note": "traveler call queued"}
```

Then:
1. **~2.5s** — dashboard: flight red (cancelled), hotel amber (conflict)
2. Traveler phone rings — answer as the traveler
3. Miles (recovery agent): explains cancel → offers 2 flights → you pick one
4. Asks to call hotel / shorten stay → you say yes
5. “Hold tight…” — you hear hold; teammate’s phone rings
6. Teammate (front desk) confirms dates in ~25s — call ends
7. Traveler agent returns, confirms, hangs up
8. Dashboard goes green (`recovery_confirmed`)

---

## Front-desk script (give to teammate)

Print this for the hotel phone:

> You are hotel front desk. Keep the call under ~25 seconds.
>
> 1. Agent will introduce themselves and give a guest name + PNR.
> 2. They ask to change check-in / check-out (fewer nights).
> 3. Ask **one** clarifying question (“Same room type?”) then say:
>    **“Yes, I’ve updated the reservation. You’re all set.”**
> 4. Hang up.
>
> Do **not** talk about payment or loyalty. A tiny bit of friction is fine; a long hold kills the demo.

---

## When the tunnel URL changes

```bash
# 1. New cloudflared/ngrok URL
# 2. Update PUBLIC_BASE_URL in .env
# 3. Re-push tools (setup script is safest):
./agents/setup_act2.sh
```

Or patch only:
```bash
./agents/patch_act2_tools.sh
vb agent use $VB_TRAVELER_AGENT_ID
vb config set --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/traveler_tools.json"
vb agent use $VB_HOTEL_AGENT_ID
vb config set --api-tools-file "${TMPDIR:-/tmp}/miles-act2-tools/hotel_tools.json"
vb agent use $VB_AGENT_ID
```

---

## Debugging

| Symptom | Fix |
|--------|-----|
| `no booking found` on cancel | Persist first; check PNR spelling |
| Cancel OK but no ring | `TRAVELER_PHONE`, `VB_TRAVELER_AGENT_ID`, outbound TOS; check API logs |
| Ring but agent invents flights | Background AI on; AI Agent mode off; Sabre MCP on traveler |
| `get_itinerary` / `call_hotel` fail | Tunnel dead or interstitial; re-verify `curl $PUBLIC_BASE_URL/health` |
| Hotel never rings | `HOTEL_PHONE`, `VB_HOTEL_AGENT_ID`; watch FastAPI during hold |
| Dashboard doesn’t flip | Wrong `session_id` in browser; confirm SSE |
| Act 1 Miles broken after setup | `vb agent use $VB_AGENT_ID` |

```bash
vb agent use $VB_TRAVELER_AGENT_ID
vb logs --json
# or: vb logs <session_id> --json
vb debug   # if --debug-mode true
```

Restart FastAPI after changing `.env` (uvicorn `--reload` picks up code, but env is read at process start — restart once after editing phones/IDs).

---

## Env reference

| Var | Required | Purpose |
|-----|----------|---------|
| `PUBLIC_BASE_URL` | yes | HTTPS origin for VB HTTP tools |
| `TRAVELER_PHONE` | yes | E.164 traveler |
| `HOTEL_PHONE` | yes | E.164 front desk |
| `VB_TRAVELER_AGENT_ID` | yes | From setup script |
| `VB_HOTEL_AGENT_ID` | yes | From setup script |
| `VOCAL_BRIDGE_API_KEY` | yes | `vb call` / CLI |
| `VB_AGENT_ID` | yes | Miles (Act 1); restored after setup |
| `ACT2_RING_DELAY_S` | no | Default `2.5` — dashboard paints before ring |
| `ACT2_TRAVELER_CALL_TIMEOUT_S` | no | Default `600` |
| `ACT2_HOTEL_CALL_TIMEOUT_S` | no | Default `280` (under VB 300s tool cap) |

---

## Files

| Path | Role |
|------|------|
| `agents/traveler_prompt.txt` | Recovery call flow |
| `agents/traveler_tools.json` | `get_itinerary`, `call_hotel` (placeholder host) |
| `agents/hotel_prompt.txt` | Front-desk call |
| `agents/hotel_tools.json` | `get_booking_context` |
| `agents/setup_act2.sh` | Create/configure agents + write `.env` IDs |
| `agents/patch_act2_tools.sh` | Only rewrite tool URLs |
| `agents/check_act2.sh` | Pre-demo validation |
| `api/routes/events.py` | `/debug/cancel`, persist, SSE |
| `api/routes/recovery.py` | `/tools/call_hotel` |
| `api/routes/context.py` | itinerary + hotel context |
