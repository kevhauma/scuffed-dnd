---
name: work-ticket
description: Work a ticket end-to-end — read it, plan the implementation, build it, tick each acceptance criterion as it verifiably passes, then check off the ticket's line in overview.md. Use whenever someone says "work on a ticket", "start ticket TICKET-XXX", "implement this ticket", "pick up the next ticket", or points you at a ticket file to build.
---

# Work a ticket to done

Drive one ticket from "not started" to "story checked off". The ticket is the source of truth:
its **Acceptance criteria** are the contract, and the matching title+checkbox line in the
version's `overview.md` gets checked off once every criterion passes.

**Never assume the docs layout or which versions exist — discover it at runtime.** Tickets live
in `docs/<version>/tickets/TICKET-<PREFIX>-<NN>-*.md`; the version's `overview.md` carries a
title+checkbox line per ticket, **listed in recommended build order top to bottom — not grouped
by area**. Mirror what you find; don't hardcode a version.

## Step 1 — Locate the ticket

- **If the user named a ticket** (`TICKET-CHAR-01`, a prefix+number, or a path), open that file.
  Resolve partial IDs by globbing `docs/*/tickets/`.
- **If no ticket was named**, scan `docs/*/tickets/` and the version's `overview.md` for **open**
  work — lines still marked `- [ ]` — and ask via `AskUserQuestion` which to work. The **first
  open, ticketed line** in `overview.md` is the suggested next one (the list is already in build
  order); check its trailing note for an unmet dependency first, and present the real currently-open
  tickets you found rather than a remembered list.
- **If the open line has no ticket link** — the foundation plan's remaining items are listed this
  way — invoke the **story-ticket** skill to expand it into a real ticket first (reusing the plan
  line's requirement numbers and the task detail in
  [tasks.md](../../../docs/v1.0_foundation/tasks.md)), then work that ticket. Never implement
  straight from a bare plan line.

Confirm you have the right file before proceeding.

## Step 2 — Read and orient

Read the **whole** ticket, not just the criteria: **User story** (who and why), **Description**,
**Current situation (as-is)** — follow its file links to the *real* code — **Desired result
(to-be)**, every **Acceptance criterion**, and **Notes**.

Pull project knowledge as needed rather than re-exploring: the **project-map** skill to locate
code, **data-model** for persistence and derived-value rules, **react-conventions** for how to
write it, and the **spec-navigator** subagent for requirement questions. Then **restate the
ticket's intent in one or two sentences** so the user can confirm you understood it.

## Step 3 — Plan, then pause for approval

Produce a concrete implementation plan **mapped to the acceptance criteria** — which
components/hooks/stores/engine modules change, which tests get added (name the cases), which
routes or UI are touched. Respect the hard rules while planning:

- Persistence goes through a **store action** — never a direct `localStorage` or storage-service
  call from a component, hook, or engine module.
- Derived numbers come from `engine/calculator.ts` / `engine/calculators/*` — never recomputed
  inline in a component, never persisted onto `Character`.
- User-authored math goes through the formula engine (`parseFormula` → `validateFormula` →
  `evaluateFormula`). No `eval`, no `new Function`.
- Feature components compose `components/ui` primitives and own all layout; base components gain
  no margin/flex/grid/positioning.
- Theme tokens only (`parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`, `royal`, `amber`,
  `font-heading`/`font-body`, `shadow-parchment*`) — no raw hex, no stock Tailwind palette.
- `src/routeTree.gen.ts` is generated — never hand-edit it.
- No new runtime dependencies without asking; the app stays browser-only with no backend.

Track the steps with `TaskCreate`/`TodoWrite`. **Present the plan and wait for the user's
go-ahead before editing any code.**

## Step 4 — Implement

Work the plan criterion by criterion, following the **react-conventions** skill (it auto-attaches
when you edit `.ts`/`.tsx`/`.css`) plus **data-model** and **project-map**. Add the
`**Validates: Requirements …**` line to the JSDoc header of each module that implements a
requirement. Keep changes scoped to this ticket — resist unrelated refactors; note out-of-scope
work rather than doing it.

**If the implementation diverges from an acceptance criterion, record the divergence at the moment
you pivot** — edit the criterion then, in the same change, not at the end. Amend the line to
describe what you are actually building and why (strike through the superseded wording, or add a
dated implementation note above the criteria). A criterion is never silently outgrown: a ticket
whose boxes describe code that doesn't exist is worse than one with open boxes, because it stops
anyone from noticing.

## Step 5 — Verify, then tick each criterion

A criterion gets ticked **only when it verifiably passes** — never on hope.

1. Run the full suite via the **verifier** subagent (`npx vitest run` + `npx tsc --noEmit` +
   `yarn run lint`). The repo has a documented set of failing tests and lint errors
   ([TEST_STATUS.md](../../../TEST_STATUS.md)) — your bar is **no new failures**, and the verifier
   reports the delta. Fix regressions before ticking anything.
2. For any criterion phrased **"Verified live in the browser: …"**, do a real check with the
   `preview_*` tools (`yarn dev`, port 3000): reproduce the scenario and capture proof
   (snapshot/screenshot/console). Ask the user first whether they want the browser check; if they
   decline, leave the box open with a note saying why.
3. For each satisfied criterion, edit the **ticket file**, changing `- [ ]` → `- [x]` **and
   appending the evidence in parentheses** — the file, the test name, or the observed behaviour
   that proves it. "Which file? which test? what did you observe?" must be answerable from the
   ticket alone, months later. A tick with no evidence is not a tick.
4. Do **not** tick a criterion that fails or that you couldn't verify — report it and keep working.
   A deliberately skipped criterion stays `- [ ]` with **why** appended: an honest open box, not a
   checked one.
5. **Final AC↔diff pass before Step 6.** Re-read every `- [x]` against the actual working tree —
   `git diff`, the file, the passing test. Any box whose evidence you cannot point at right now
   gets unticked and either finished or recorded as a divergence. Run this even when you ticked
   carefully on the way through; it catches criteria that were true when ticked and stopped being
   true two steps later.

Optionally run the **conventions-reviewer** subagent on the diff before finalizing.

## Step 6 — Check off the story (only when ALL criteria are `[x]`)

- Open the `overview.md` for the ticket's version.
- Find the line whose ticket **link** matches this ticket ID — match on the link, not the title
  wording.
- Flip that line's `- [ ]` → `- [x]`.
- If the ticket was expanded from a foundation plan line, tick the corresponding task in
  [tasks.md](../../../docs/v1.0_foundation/tasks.md) too, so the historical plan stays truthful.

## Step 6.5 — Update the knowledge skills if this ticket moved the map

The **project-map**, **data-model**, and **react-conventions** skills are what the next agent
reads *instead of* exploring, so a stale one actively misdirects. Keeping them current is part of
the ticket that changed them, not a later cleanup.

Update `.claude/skills/project-map/SKILL.md` in this same change if the ticket:

- added, removed, or moved a **route** or a feature folder;
- added, removed, or moved a **store**, an **engine module**, or a **service**;
- added a **`components/ui` primitive** or a **shared component** other code should reuse;
- changed **where a kind of file lives** (e.g. filled in the empty `components/play/`).

Update `.claude/skills/data-model/SKILL.md` if it changed a persisted shape, a storage key, the
derived-vs-stored split, or the import/export validation surface.

Update `.claude/skills/coding-conventions/SKILL.md` if it changed a pattern the skill describes,
or established a new convention future work should follow — one or two sentences in the matching
section, not a paragraph.

Prefer pointing at a barrel or an exemplar file over restating its contents: a link that resolves
stays true, a copied list does not.

## Step 7 — Report and stop

Summarize what changed, link the now fully-`[x]` ticket and the checked story line, and show the
verification proof (test/typecheck/lint result + any browser evidence). **Leave the working tree
for the user to review — do not commit** unless they ask. If they do, the commit message convention
is the ticket ID and title: `TICKET-CHAR-01 Create CharacterList component`.
