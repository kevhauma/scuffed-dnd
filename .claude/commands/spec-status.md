---
description: Report ticket/plan progress and the health of the working tree
---

Give a short status report on this project. Do not change any files.

1. List `docs/` to find the versions that exist, then read each `overview.md`: count checked vs
   unchecked lines, and split the open ones into **ticketed** (linking to `tickets/TICKET-*.md`)
   and **plan lines** (still marked *(plan §N)*, needing `story-ticket` expansion first). Name the
   next open line in build order and any dependency note it carries.
2. Run the **verifier** subagent (`npx vitest run`, `npx tsc --noEmit`, `yarn run lint`) and report
   its delta against [TEST_STATUS.md](../../TEST_STATUS.md) — regressions only, not the documented
   baseline.
3. Run `git status --short` and `git log --oneline -5`.
4. Flag drift: a ticket whose criteria are all `[x]` but whose `overview.md` line is still open, a
   ticked criterion with no evidence appended, or implemented components with no matching ticket
   or plan item.

Output: a compact summary — progress line per version, next ticket, verification delta, then
anything that looks wrong. Keep it under ~20 lines; no code blocks unless something is failing.
