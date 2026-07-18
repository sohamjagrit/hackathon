---
description: Run qa-engineer and developer together to test Miles (unit, smoke, integration, behavioral) and fix what's found
argument-hint: [scope — e.g. "booking flow", "hotel search", empty = full Act 1 pass]
---

You are running a quality pass on Miles, the voice-native travel agent built for the DeepLearning.AI Voice AI Hackathon (Sabre × Vocal Bridge). Today is the hackathon deadline: 2026-07-18. This command coordinates two subagents — `qa-engineer` (tests, does not fix) and `developer` (fixes, does not decide what to test) — working together in a find → fix → re-verify loop. Neither subagent replaces the other; do not let `developer` write ad hoc tests or `qa-engineer` patch code.

Scope for this run: $ARGUMENTS (if empty, default to a full Act 1 pass — search, selection, add-ons, booking, seats, email — since Act 1 is what's actually being demoed today; skip Act 2 entirely, it's not started, and skip `contracts/`/`sabre/` legacy code unless the scope explicitly names them).

Follow this sequence:

1. **Orient.** Read `CLAUDE.md`'s "Current status" and "Open issues / next tasks" — don't re-test what's already confirmed working today, and prioritize whatever's flagged as needing re-verification (e.g. a recent booking-flow prompt change). If the scope names something not yet built, say so and stop rather than inventing tests for code that doesn't exist.

2. **Scope call, out loud, before running anything.** State plainly: given time left before the deadline, is a full four-tier pass (smoke/unit/integration/behavioral) realistic, or should this run focus on smoke + integration only and skip expensive live-call behavioral testing? Bias toward smoke and integration tests — they're cheap and catch the most damage per minute spent. Reserve full voice-call behavioral testing for flows that just changed and haven't been re-verified yet (per `qa-engineer.md`'s tier definitions).

3. **`qa-engineer` builds and runs the test plan first.** Delegate to the `qa-engineer` subagent with the concrete scope from step 2 (not a vague "test everything"). It should, in order:
   - Run smoke checks (servers start clean, `/health`, `vb config show` sanity — AI Agent OFF / Background AI ON, `SABRE_TOKEN` not expired).
   - Check client-action contract consistency: does every `trigger_client_action(...)` call in `agents/miles_prompt.txt` match a shape `frontend/src/hooks/useTripActions.ts`'s reducer actually expects, per `agents/client_actions.json`'s definitions?
   - Run `vb mcp test "<query>"` for any Sabre/MCP chain in scope (search, booking, seat modify) to check `conversationId`/`offer_id`/`property_id` threading without spending a live call.
   - Only place a real voice call and pull `vb logs <session_id> --json` if the scope specifically needs behavioral/flow verification that the cheaper tiers can't answer — and announce it first, since the VB agent is shared.
   - It must NOT write fixes. It reports failures as concrete repros: exact command/output, file/line or session ID.

4. **`developer` fixes what `qa-engineer` found.** Hand off each failure individually with its repro — do not paraphrase or summarize away the specifics `qa-engineer` gathered. `developer` follows its own hard rules (`.claude/agents/developer.md`): no proxy backend layer, `AI Agent mode OFF`/`Background AI ON` untouched, `offer_id`/`property_id`/`conversationId` copied verbatim, no partial bookings, `contracts/` untouched, and no live `vb` push without announcing it first and editing the repo file first.

5. **`qa-engineer` re-runs the exact same check that failed** to confirm the fix — not a broader re-test, not "looks right now." A fix isn't done until the original failing repro passes.

6. **Loop steps 3-5** for remaining failures in scope, or stop and report clearly if you're running out of time — an honest "ran out of time, X still failing/untested" beats a rushed, unverified fix.

7. **Guardrails for this whole run:**
   - Treat the shared live VB agent as a scarce resource — batch `vb mcp test`/live-call usage, don't fire them off speculatively per failure.
   - Never let either subagent flip AI Agent mode or Background AI, or push VB config live without an explicit announcement.
   - Never mark anything passing without `qa-engineer` having actually run it and seen the output — no "the fix looks correct" as a substitute for re-verification.
   - If a failure traces back into `contracts/`, stop and flag for human sign-off instead of fixing it.

8. **Close the loop.** Report a clear summary: what was tested, what passed, what failed and got fixed (with the re-verification that confirms it), what's still flaky or untested and why, and any live `vb` pushes or live calls made during the run. If results change something `CLAUDE.md` claims (e.g. confirms or disproves "booking commit needs re-test"), say so explicitly so a human or `/documentation` can update it — don't update `CLAUDE.md` yourself as part of this command.
