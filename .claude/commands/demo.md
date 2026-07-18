---
description: Pre-flight checklist and rehearsal for presenting Miles to hackathon judges today
---

Run a pre-demo checklist for Miles (voice-native travel agent, Sabre x Vocal Bridge Hackathon, demo/deadline day is TODAY, 2026-07-18). Work through these steps in order, reporting status as you go. Don't assume anything about what's currently working — state changes fast this close to the deadline.

0. **Read `CLAUDE.md` first.** Check the "Current status" and "Open issues / next tasks (in priority order)" sections at the top to see what's actually verified working right now vs known-flaky vs not started, before you assume anything below.

1. **Check `SABRE_TOKEN` expiry.** Look at `.env` at repo root. `SABRE_TOKEN` expires ~2026-07-20 — it should still be valid today, but if any Sabre call comes back 401 during the dry run, that's the cause: regenerate it at the hackathon portal and update `.env`.

2. **Check VB agent config.** Run `vb config show` (or `~/.local/bin/vb config show`) and confirm the two settings that break everything if flipped: **AI Agent mode is OFF** and **Background AI is ON**. If either is wrong, fix it and note that config changes only take effect on the *next* call, not mid-call, and this is a shared live agent — flag that clearly if you change it.

3. **Confirm both servers are running.**
   - Backend: `uv run uvicorn api.main:app --reload` on port 8000 (only needed for `/api/voice-token`).
   - Frontend: `cd frontend && npm run dev` on port 5173.
   If either isn't running, start it and confirm it comes up clean.

4. **Dry-run Act 1 (book by voice) end to end.** Open http://localhost:5173, allow mic access, and walk the script:
   - Ask Miles for a flight; confirm the `show_flights` client action renders cards on the dashboard.
   - Pick a flight; confirm hotel search kicks off and `show_hotels` renders.
   - Pick a hotel; confirm the booking commit completes (~60s, this is the step re-tested after the 7/16 night template fix v2 for the conversationId-isolation bug — treat it as the most likely failure point).
   - If booking fails or hangs, pull `vb logs <session_id> --json` to see the actual tool calls/transcript and diagnose rather than guessing.
   - While the booking is committing, confirm Miles fills the wait with concierge talk (weather via `get_weather`, restaurant/attraction recommendations).

5. **Confirm the itinerary email actually arrives** (Zapier MCP -> Gmail) after a successful booking. Don't just check that the tool call was made — check an actual inbox.

6. **Act 2 (disruption recovery, phone call).** Check `CLAUDE.md` for current status. As of the last known state this was not started. If it's still not started, do not attempt to dry-run it — explicitly tell the user the demo should be scoped to Act 1 only and Act 2 should not be promised to judges. If it has since been built, dry-run the phone flow: cancelled flight -> Miles calls the traveler -> replans flight then hotel with an approval gate at each step -> brief hold while placing a real nested call to the hotel -> confirms, all in one call.

7. **Check the PayPal sandbox checkout page loads** (`CheckoutPage` in `frontend/`) without errors.

8. **Summarize.** At the end, give a clear go/no-go style summary: what's confirmed working right now, what's flaky, what to avoid promising judges, and any action items (e.g. regenerate token, restart a server, re-test booking) before the actual presentation.
