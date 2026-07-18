---
description: Diagnose and fix a bug in Miles by reproducing it first and finding the real root cause
argument-hint: <bug description>
---

You are diagnosing and fixing a bug in Miles, the voice-native travel agent built for the DeepLearning.AI Voice AI Hackathon (Sabre × Vocal Bridge). Today is the hackathon deadline: 2026-07-18 — be fast, but do not fake a fix.

Bug reported: $ARGUMENTS

Follow this sequence:

1. **Reproduce before touching anything.** Do not guess at a fix from the description alone.
   - If the bug is voice- or MCP-related in any way (Miles said/did the wrong thing, a Sabre tool call failed or returned unexpected data, a client action didn't fire, Background AI job didn't complete), your primary tool is `vb logs <session_id> --json` — pull the actual transcript and tool-call trace for the session in question. This is the ground truth; don't speculate about what Miles "probably" did.
   - If you don't have a session ID or need to isolate a specific Sabre/MCP chain without a full voice call, use `vb mcp test "<query>"` to reproduce it directly and faster.
   - If the bug is purely frontend rendering (dashboard not reflecting state correctly), reproduce with `cd frontend && npm run dev` (port 5173) and check `frontend/useTripActions.ts` against the client-action payloads it's supposed to be handling — cross-reference with `agents/client_actions.json` for the expected shape.
   - If it's backend/token related, `uv run uvicorn api.main:app --reload` (port 8000) — remember `api/` should only be serving `/api/voice-token`; anything else living there is itself suspicious.

2. **Find the root cause, not the symptom.** This codebase has almost no custom backend to hide bugs in — that's a feature, use it. Narrow down to one of:
   - **Prompt/behavior issue** in `agents/miles_prompt.txt` — Miles said the wrong thing, called tools in the wrong order, read structured data aloud instead of sending a client action, or violated the "prose only, 1-2 sentences" rule.
   - **Client action / dashboard issue** — wrong or missing data in `agents/client_actions.json` definitions, or a bug in how `frontend/TripApp.tsx` / `useTripActions.ts` / `Dashboard` consumes them. Remember the dashboard must render ONLY from client actions, never from the transcript — if it's inferring state from transcript text, that's the bug.
   - **MCP/Sabre issue** — a tool call failing, `offer_id` / `property_id` / Sabre `conversationId` not being carried verbatim across a background job's steps (`submit_background_query` → `check_query_status`), or a slow chain being called synchronously instead of through Background AI.
   - **Config drift** — check `vb config show` / `vb config get` against what's actually in `agents/` to see if the live agent has drifted from the checked-in source of truth.
   - Do not paper over the bug: no silent `try/except` that swallows the error, no disabling a validation/check to make symptoms go away, no special-casing the one input you happened to test with. If the fix isn't obvious after reproduction, delegate root-cause investigation to the `developer` subagent with the concrete repro (session ID, `vb mcp test` output, or exact steps) rather than guessing.

3. **No partial-booking or ordering shortcuts.** If the bug or fix touches booking flow, do not let a fix introduce a path where a PNR could be created before all legs are confirmed — that rule is inviolable even under deadline pressure.

4. **If the fix requires a live config push, announce it first.** There is ONE shared live VB agent for the whole hackathon — `vb prompt set --file agents/miles_prompt.txt` or `vb config set` changes it for everyone immediately, mid-demo included. Edit the file in `agents/` first, then explicitly say what you're about to push and why before running the command. Config changes apply on the *next* VB call only, not mid-call, so factor that into how you verify.

5. **Don't touch what you don't need to.** `contracts/` is FROZEN — if the root cause traces back there, stop and ask a human rather than editing it. `sabre/` is legacy and unused by Act 1 — a bug report pointing there likely means you're looking in the wrong place; double-check before spending time on it.

6. **Verify the fix by re-running the exact repro from step 1** — same `vb mcp test` query, same voice flow re-triggered and checked via a fresh `vb logs <session_id> --json`, or the same frontend interaction. A fix isn't done until the original repro passes; "looks right in the code" is not verification.

7. **Report back concisely**: what the root cause was, what changed and where (file paths), and what you ran to confirm it's fixed. If it's a live-agent-affecting fix, note that it was pushed and announced. If `CLAUDE.md`'s "Open issues" section references this bug, update it.
