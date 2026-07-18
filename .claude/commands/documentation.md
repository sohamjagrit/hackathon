---
description: Reconcile CLAUDE.md, README.md, and guides with what actually changed in the repo
argument-hint: [scope]
---

You are updating documentation for Miles (voice-native travel agent, Sabre x Vocal Bridge hackathon project) so it matches reality. Docs here drift fast — `CLAUDE.md`'s "Current status" and "Open issues / next tasks (in priority order)" sections at the top are the authoritative source of truth for what's done vs not, and they must stay accurate.

Scope for this run: $ARGUMENTS (if empty, scan recent changes broadly across the repo instead of focusing on one area).

Do the following:

1. **Figure out what actually changed.** Look at recently modified files relevant to the scope (or all of `agents/`, `frontend/`, `api/`, `.claude/guides/` if no scope given). Pay special attention to `agents/miles_prompt.txt` (the source-of-truth prompt — Sabre workflow rules, conversationId handoff, client-action payload templates, concierge behavior), `agents/client_actions.json`, `agents/api_tools.json`.

2. **Diff reality against `CLAUDE.md`.** Read the current "Current status" and "Open issues / next tasks (in priority order)" sections. Compare each claim against what you find in the code/config. Look for:
   - Things marked as broken/in-progress that are now fixed (or vice versa).
   - New work that isn't reflected yet (e.g. Act 2 disruption-recovery progress, PayPal checkout changes, dashboard client-action changes).
   - Stale priority ordering in "next tasks" once something is done.

3. **Update `CLAUDE.md`.** Preserve its existing terse, dated-bullet style exactly — do not rewrite the doc's voice or restructure it wholesale. Add/edit bullets in place, keep dates on entries the way the doc already does. Only touch the sections that need it.

4. **Update `README.md`** only if setup steps, commands, or architecture actually changed (e.g. a new env var, a new dev command, a new service). Don't touch it if nothing setup-relevant changed.

5. **Update the relevant `.claude/guides/` doc** (`project-guide.md` is the design doc, `project-summary.md` is the plain-language version) if the architecture or flow it describes is now stale. Keep both in sync with each other if you touch one and the change is user-facing.

6. **Hard rule: never mark something (checkmark/verified/done/working) that wasn't actually verified.** If you're not sure whether something was actually tested end-to-end (e.g. "booking commit works" vs "booking commit code was changed but not re-tested"), say so explicitly or ask the user rather than guessing. This project has a live history of things looking fixed in code but not being re-verified (e.g. the 7/16 night template fix v2 for the conversationId-isolation bug) — don't repeat that mistake in docs.

7. You may delegate the actual writing/editing work to the `tech-writer` subagent (it exists at `.claude/agents/tech-writer.md`) if you want a second pass or a cleaner voice match — brief it with the specific diffs you found and the exact sections to touch, don't just tell it "update the docs."

8. When done, report which files you changed and a one-line summary of what changed in each. Do not touch `contracts/` (frozen) or `sabre/` (legacy, unused by Act 1) unless the scope explicitly calls for it.
