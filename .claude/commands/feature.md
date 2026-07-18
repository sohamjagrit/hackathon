---
description: Plan and implement a new feature for Miles, scoped correctly against Act 1 (voice booking) vs Act 2 (disruption recovery)
argument-hint: <feature description>
---

You are implementing a new feature for Miles, the voice-native travel agent built for the DeepLearning.AI Voice AI Hackathon (Sabre × Vocal Bridge). Today is the hackathon deadline: 2026-07-18. Time is short — be decisive, not exhaustive.

Feature requested: $ARGUMENTS

Follow this sequence:

1. **Orient yourself first.** Read `CLAUDE.md` (especially the "Current status" and "Open issues" sections) and skim `.claude/guides/project-guide.md` (the architecture/design doc) before touching anything. If the feature touches the frontend, also read `.claude/miles-design-system.md` — it is the authoritative visual spec; never hardcode hex colors or invent styling that isn't in it.

2. **Make an explicit Act 1 vs Act 2 scope call, out loud, before writing any code.**
   - Act 1 = book-by-voice in the browser (VB web mic → Miles → Sabre MCP tools → real PNR, with the React dashboard mirroring state via client actions). This is verified working end-to-end except the booking commit is being re-tested.
   - Act 2 = phone-based disruption recovery. Not started yet.
   State clearly which act (or both) this feature belongs to, and whether it's realistic to land it before the deadline given what's already in flight (booking-commit retest). If the feature is Act 2 and Act 1 isn't fully solid yet, flag that trade-off explicitly and ask before deprioritizing Act 1 work.

3. **Respect the architecture — do not invent a backend.** There is no custom orchestration layer. Vocal Bridge (VB) is itself the orchestrator and voice runtime:
   - Miles (the VB agent) calls Sabre MCP tools directly — no middleman service.
   - Slow Sabre chains (15-25s) must go through VB's Background AI (`submit_background_query` / `check_query_status`), not synchronous calls.
   - Any state the dashboard needs must be pushed via VB client actions (`show_flights`, `show_hotels`, `flight_selected`, `hotel_selected`, `booking_confirmed`, or a new action you define in `agents/client_actions.json`) over the LiveKit data channel. The dashboard (`frontend/`) renders ONLY from client actions, never from the transcript — do not add transcript-parsing logic.
   - `offer_id` / `property_id` / Sabre `conversationId` must be threaded verbatim across any background job steps you add.
   - No partial bookings: a PNR is only created after all legs are confirmed.
   - AI Agent mode must stay OFF; Background AI must stay ON — don't flip either.
   - Voice responses stay prose-only, 1-2 sentences; never make Miles read structured data aloud — send it to the dashboard instead.

4. **Sequence the work.** If the feature is non-trivial (spans prompt + MCP + frontend, or has real ordering/dependency risk), delegate to the `project-planner` subagent to produce a step sequence before implementing. For a small, well-scoped change, skip straight to implementation.

5. **Implement.** Delegate to the `developer` subagent for the actual code/prompt changes, or do it directly if it's small enough that spawning an agent would cost more than it saves. Key file map:
   - Voice/prompt behavior → `agents/miles_prompt.txt` (source of truth for what Miles says and does — most load-bearing file in the repo).
   - New/changed client actions → `agents/client_actions.json`.
   - New external API tools (e.g. alongside `get_weather`) → `agents/api_tools.json`.
   - MCP server wiring → `agents/mcp_servers.json` — this file is gitignored and pushing it via `vb mcp` **replaces the entire MCP config**, so be careful and check current state with `vb config show` first.
   - Frontend: `frontend/App.tsx` stays a bare `VocalBridgeProvider` wrapper — never add hooks there. All VB hooks live in `frontend/TripApp.tsx`, which composes `VoicePanel`, `Dashboard`, `ItineraryPage`, `CheckoutPage`. Client-action subscriptions go through `useTripActions.ts`.
   - Backend: `api/` should only ever need to serve `/api/voice-token` — if your feature seems to need a new backend endpoint, stop and reconsider whether it should instead be a direct MCP tool call or client action, since that would break the "VB is the orchestrator" rule.
   - `contracts/` is FROZEN — do not modify anything there without asking a human first, even if the feature seems to require it.

6. **Respect the single shared live agent.** There is ONE live VB agent shared by everyone at the hackathon. `vb prompt set` and `vb config set` change it immediately for everyone, including mid-demo. Always edit the file in `agents/` first, get it right, and explicitly announce before running `vb prompt set --file agents/miles_prompt.txt` or any `vb config set` / `vb mcp` push. Remember config changes only take effect on the *next* VB call, not mid-call, so don't expect an already-running session to pick up changes.

7. **Verify.** Use `vb mcp test "<query>"` to sanity-check any new/changed MCP chain without a full voice call. For anything voice-driven, use `vb logs <session_id> --json` after a real test call to confirm the client actions and tool calls fired as expected.

8. **Close the loop.** Update `CLAUDE.md`'s "Current status" and "Open issues" sections to reflect the new feature's state (done / partially done / blocked), or hand off to `/documentation` if that command exists and is more appropriate. Don't leave the doc stale.

Work efficiently — this is hackathon crunch time, not a place for gold-plating. Land a working, correctly-scoped increment over a perfect one.
