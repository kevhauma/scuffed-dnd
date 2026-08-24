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
- A field the User types a **formula** into renders `FormulaPreview` (TICKET-FORM-08) beneath it,
  with that attachment point's `FormulaOwner` — never a bare `FormulaEditor`, never a second
  hand-rolled evaluation.
- Theme tokens only (`parchment-*`, `ink-*`, `stone-*`, `crimson`, `forest`, `royal`, `amber`,
  `font-heading`/`font-body`, `shadow-parchment*`) — no raw hex, no stock Tailwind palette.
- `src/client/routeTree.gen.ts` is generated — never hand-edit it.
- A closed set of string values is a `as const` object with the type derived from it, and call
  sites reference the constant — **no new bare `'a' | 'b' | 'c'` type.**
- **SOLID and KISS**, as the **react-conventions** skill spells them out for this codebase: one
  responsibility per module, `ConfigPanelShell` extended rather than given a prop per caller,
  narrow props, engine code unaware of React and storage — and no abstraction, option, or flag
  introduced before its third caller exists.
- No new runtime dependencies without asking. v3.0 adds exactly four, listed in its
  [D11](../../../docs/v3.0_backend/overview.md#d11--new-dependencies-in-full); anything beyond that
  list is a new decision there, not a judgement call inside a ticket.
- **`src/` has three roots** — `shared/` (the Kernel), `client/`, `server/`. A rule both sides need
  lives in `shared/`; crossings are spelled `#shared/…`; `yarn run check` refuses the rest.

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
   `yarn run lint`). **The suite is green and `yarn run check` is clean**
   ([TEST_STATUS.md](../../../TEST_STATUS.md)) — any failing test, any newly-skipped test, and any
   lint finding is a regression, not background noise. Typecheck keeps a documented 2-error
   baseline and the verifier reports that one as a delta. Fix regressions before ticking anything.
2. Run **fallow** and act on three of its outputs (the **react-conventions** skill's *Verification*
   section has the commands and the reasoning):
   - **dead code the ticket introduced** — an export nothing imports, a type nobody names, a file
     the refactor orphaned — deleted in this same change, not left for later;
   - **complexity** on a function the ticket added or grew past a threshold — split now;
   - any file the ticket touched that comes back tagged **Accelerating** — churn and complexity
     both rising — recorded as a row in TEST_STATUS.md's hotspot table, naming this ticket.

   If fallow isn't available in the session, say so out loud rather than skipping it silently.
3. For any criterion phrased **"Verified live in the browser: …"**, do a real check with the
   `preview_*` tools (`yarn dev`, port 3000): reproduce the scenario and capture proof
   (snapshot/screenshot/console). Ask the user first whether they want the browser check; if they
   decline, leave the box open with a note saying why.
4. For each satisfied criterion, edit the **ticket file**, changing `- [ ]` → `- [x]` **and
   appending the evidence in parentheses** — the file, the test name, or the observed behaviour
   that proves it. "Which file? which test? what did you observe?" must be answerable from the
   ticket alone, months later. A tick with no evidence is not a tick.
5. Do **not** tick a criterion that fails or that you couldn't verify — report it and keep working.
   A deliberately skipped criterion stays `- [ ]` with **why** appended: an honest open box, not a
   checked one.
6. **Final AC↔diff pass before Step 6.** Re-read every `- [x]` against the actual working tree —
   `git diff`, the file, the passing test. Any box whose evidence you cannot point at right now
   gets unticked and either finished or recorded as a divergence. Run this even when you ticked
   carefully on the way through; it catches criteria that were true when ticked and stopped being
   true two steps later.

Optionally run the **conventions-reviewer** subagent on the diff before finalizing.

## Step 5.5 — Land the feature's sheet-import fragment

Every feature carries real data from the source spreadsheet, not just a shape. `docs/imports/` holds
one JSON fragment per built feature; `docs/imports/ducklets.json` is their merge and the file a
User can actually import. Read [docs/imports/README.md](../../../docs/imports/README.md) for the
envelope and the rules before writing one.

- **New entity or new configuration field** → add or extend that feature's fragment with what the
  [source sheet](https://docs.google.com/spreadsheets/d/1Y_KXFpPQTXaPi2oXn-LdZBTPZNLMPZ2xb3iK7wtHum4/edit)
  actually holds, citing the exact ranges in `source.ranges`.
- **Changed shape of an existing entity** → bring its fragment forward in the same change, and say
  in `notes` what moved.
- **The sheet has no data for it** (XP thresholds, exchange rates) → say that in `notes` and leave
  the field neutral. Never invent a number to fill a required field.
- **Pure engine or UI ticket that touches no persisted shape** → nothing to do here; say so.

Then `yarn run sheet:import` and commit the regenerated `ducklets.json` alongside the fragment.
`npx vitest run src/shared/services/sheetImport.test.ts` is the check — it fails if the merge is stale or
the corpus no longer imports.

## Step 6 — Check off the story (only when ALL criteria are `[x]`)

- Open the `overview.md` for the ticket's version.
- Find the line whose ticket **link** matches this ticket ID — match on the link, not the title
  wording.
- Flip that line's `- [ ]` → `- [x]`.
- If the ticket was expanded from a foundation plan line, tick the corresponding task in
  [tasks.md](../../../docs/v1.0_foundation/tasks.md) too, so the historical plan stays truthful.

## Step 6.5 — Update the documentation this ticket invalidated

The knowledge skills and the top-level docs are what the next agent — and the next human — read
*instead of* exploring. A stale one doesn't merely fail to help; it actively misdirects, because
it is trusted. Bringing them forward is part of the ticket that broke them, never a later cleanup.

**Walk this table and say what you found for each row**, including the rows you checked and left
alone. "README unchanged — no structural move" tells the next reader it was considered; silence
tells them nothing.

| Document | Update it when the ticket… |
|---|---|
| `.claude/skills/project-map/SKILL.md` | added, removed, or moved a **route** or feature folder; a **store**, **engine module**, or **service**; a **`components/ui` primitive** or shared component others should reuse; or changed **where a kind of file lives** |
| `.claude/skills/data-model/SKILL.md` | changed a **persisted shape**, a storage key, the derived-vs-stored split, or the import/export validation surface |
| `.claude/skills/coding-conventions/SKILL.md` | changed a pattern the skill describes, or **established a convention** future work should follow — one or two sentences in the matching section, not a paragraph |
| [CLAUDE.md](../../../CLAUDE.md) | changed a **hard rule**, a command, a verification step, the where-knowledge-lives table, or the stack line. A hard rule that the ticket deliberately reverses gets **replaced**, not quietly contradicted by the code |
| [ONBOARDING.md](../../../ONBOARDING.md) | changed the layer cake, the end-to-end data flow, the setup steps, the hard rules, the everyday commands, or added a **gotcha a newcomer would hit** (§9) |
| [README.md](../../../README.md) | changed the source tree drawn under *Project Structure*, the technology stack, the getting-started commands, or the Configuration/Play feature lists |
| [docs/README.md](../../../docs/README.md) | minted a **ticket prefix**, added a version folder, or changed the `docs/` layout itself |
| [TEST_STATUS.md](../../../TEST_STATUS.md) | changed the **test count** (record the delta and *why*, in the existing prose style), moved the typecheck or lint baseline, or surfaced an **accelerating hotspot** for the hotspot table |
| `docs/<version>/requirements.md` | implemented something that **contradicts a numbered requirement**. Amend the requirement rather than shipping code and spec that disagree — and say so in the ticket, since a requirement change outranks a ticket |
| `docs/<version>/overview.md` | is where Step 6 ticks the story line — plus any **decision record** (`D5`, `D14`, …) the ticket settled differently |

Three rules for the edits themselves:

- **Same change as the code.** A doc PR that trails the code by a week is a week of the doc lying.
- **Point, don't copy.** Prefer a link to a barrel or an exemplar file over restating its contents:
  a link that resolves stays true, a copied list rots silently.
- **Delete what stopped being true.** Removing a paragraph the ticket obsoleted counts as updating
  the doc. Leaving it beside the new paragraph leaves the reader to guess which one is current.

## Step 7 — Report and stop

Summarize what changed, link the now fully-`[x]` ticket and the checked story line, and show the
verification proof (test/typecheck/lint result + any browser evidence). **Leave the working tree
for the user to review — do not commit** unless they ask. If they do, the commit message convention
is the ticket ID and title: `TICKET-CHAR-01 Create CharacterList component`.
