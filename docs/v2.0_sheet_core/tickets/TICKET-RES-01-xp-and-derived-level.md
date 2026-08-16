# TICKET-RES-01 — XP and curve-derived level

- **Area:** Resources & progression (new area)
- **Type:** Feature + Refactor (inverts v1.0's definition of level)
- **Traceability:** Concept [20 · Resource & action](../../excel%20export%20summary/concepts/20-resource-and-action.md); Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md) (`xp_thresholds`)

## User story

As a Player, I want to earn XP and have my level follow from it, so awarding experience is
mechanically meaningful instead of a tally nothing reads.

## Description

The spec closes the loop the sheet left open: XP accumulates, level derives from it through a
configurable curve. The app has no XP and defines level as the sum of points spent — backwards.
The budget consequence is TICKET-RES-02; pool behaviours are TICKET-RES-03.

## Current situation (as-is)

- No `experience` anywhere in `src/`.
  [`characterSummary.ts`](../../../src/engine/characterSummary.ts): "Level is the sum of the
  character's allocated main skill levels" — level as a function of spend, the reverse of the
  spec's `XP → level → budget → spend` chain.
- The sheet's `exp.gs` Apps Script (award/deduct — the workbook's only XP mechanics) has no
  analogue.

## Desired result (to-be)

- `Character.experience: number` — accumulate-only player state (a sanctioned stored number,
  like resource currents), with **Award XP / Deduct XP** store actions and sheet controls
  (relative amount entry, one action per click — mirroring `exp.gs`).
- **`level = curve.xp_thresholds(experience)`** via CRV-01 reverse lookup;
  `calculateCharacterLevel` reimplements over it and stays the single definition every screen
  reads (`CharacterSummary.level` follows).
- `SheetHeader` shows level and XP; a new character starts at XP 0 → the curve's level 1.

## Acceptance criteria

- [x] Award/Deduct persist through store actions; XP never resets, has no max, and deducting below 0 is refused (tests). (`awardExperience`/`deductExperience` in [`characterStore.ts`](../../../src/stores/characterStore.ts); 12 tests in `characterStore.test.ts` → "Experience": accumulation across awards, a 10-million award to show there is no max, a deduction to exactly 0, a **refusal** that writes nothing when it would go below 0, both actions refusing 0/negative/`NaN`/`Infinity`, other characters untouched, an unknown id writing nothing, and a guard asserting no `reset*Experience` action exists.)
- [x] Level tracks the curve at boundaries: exactly at a threshold, one below, extrapolated beyond the last row (tests). (13 tests in [`characterSummary.test.ts`](../../../src/engine/characterSummary.test.ts) over a 1/2/3/4 table at 0/300/900/2700: `it.each` for each threshold exactly, `it.each` for one XP below each, extrapolation past the last row, plus the two failure modes — `outOfRange: 'error'` and a ruleset with no `xp_thresholds` curve.)
- [x] No other definition of level remains (grep: nothing sums `investedStatPoints` for display). (`calculateCharacterLevel` is the only definition and no longer reads `investedStatPoints` at all; a grep for `investedStatPoints` with `reduce`/`sum` in non-test source returns nothing. The remaining sum in `engine/skillAllocation.ts` measures spend against a *budget*, which is TICKET-RES-02's concern rather than a level. Asserted rather than only grepped by "should ignore invested points entirely — level no longer follows spend", and by the character list test where the character with the larger allocation has the smaller level.)
- [x] Header display composes `ui/` primitives, theme tokens only. (`SheetHeader` composes `Card`/`Text`/`Button`/`ErrorChip`; the new [`ExperienceControl`](../../../src/components/play/sheet/ExperienceControl.tsx) composes `Input`/`Label`/`Button` and owns its own layout. `border-stone-200` is the only colour either adds.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the verification note below.)
- [ ] Verified live in the browser: award XP across a threshold, watch the level change. **Left open at the User's request** — they declined the live check for this run. The automated suite drives the header's own Award/Deduct controls and asserts the level moves across a threshold, so what a browser would add is the visual.

## Notes

- Real thresholds are open question #8 — the CRV-03 seed ships the shape; the User tunes rows.
- Data-driven Actions (`operation`/`condition`/`confirm` as records) arrive when spells need
  them; v2.0 ships the seed behaviours as plain store actions.

## Implementation notes

1. **Level is a `FormulaResult`, not a number** — decided with the User on pickup. The curve is the
   User's data like any other: they can delete it, or set `outOfRange: 'error'` and leave a
   character's XP outside the table. A confident level 1 in those cases would silently misprice
   every budget RES-02 derives from it, so the sheet header and the character card chip it instead.
   `CharacterSummary.level` widened with it.
2. **`calculateCharacterLevel` now takes the `Configuration`.** The signature change is the point:
   every call site became a compile error rather than silently reading a stale definition — the
   same lever SKL-02 used on `calculateSkills`, and it caught all three.
3. **The curve is found by name**, the third thing to be after `const.bonus_divider` and
   `const.race_blend_divisor`. Same consequence, recorded again: renaming `xp_thresholds` breaks the
   link rather than following it, because there is no User formula for `references.ts` to re-spell.
   Unlike those two this one *reports* rather than falling back, per note 1.
4. **`SUPPORTED_SCHEMA_VERSION` 5 → 6**, per RACE-01's convention. The bump is what makes stale
   in-milestone data meet IO-03's notice rather than reading `experience` as `undefined` and
   levelling everyone at the curve's floor. It rippled to 37 test fixtures, the
   `scripts/build-sheet-import.mjs` generator, and `examples/demo-ruleset.json` — the last two
   caught by their own guards (`sheetImport.test.ts` and `exampleRuleset.test.ts`) exactly as those
   suites were written to do, rather than by anyone noticing.
5. **Deducting below zero is a refusal, not a clamp.** `exp.gs` deducts a stated amount; quietly
   deducting less than asked would leave the table believing a penalty landed in full. Nothing is
   written, and the array identity is unchanged so no subscriber re-renders over a no-op.
6. **Award and deduct each refuse a negative amount.** Each states its own direction, so accepting
   a negative would let `awardExperience(-100)` take XP away without passing the below-zero check.
7. **No `docs/imports/` fragment is owed.** `experience` is character state and the corpus holds
   rulesets. `docs/imports/curves.json` already records that the sheet has no XP table — level is
   hand-typed in `Charactersheet!E5`, Concept 06 open question #8 — which stays true; the seeded
   `xp_thresholds` curve is still shape-only and waits for the User. `ducklets.json` was
   regenerated for the version bump alone.

8. **Review found a real hole the schemaVersion bump does *not* close.** The gate reads the
   *Configuration*, so a characters key beside a fresh or absent config never meets IO-03's notice
   (IO-03 implementation note 5). A character stored before this ticket therefore loads with
   `experience === undefined`, and the failure is the quiet kind note 1 exists to prevent:
   `lookupCurve(curve, undefined)` falls past every range check and returns the first row — a
   confident **level 1** — while an award computes `undefined + n` and persists `NaN`, which then
   reads as level 1 forever and cannot be undone from the UI. Closed on both sides: `loadCharacters`
   now filters on `Number.isFinite(character?.experience)` alongside the two STAT-01 fields, and
   `applyExperienceChange` refuses to compute on a non-finite stored total rather than repairing it.
   Four cases in `storage.test.ts` (absent / `null` / non-numeric / `NaN`) and one in
   `characterStore.test.ts`.
9. **Four smaller review findings, all fixed:** `ExperienceControl` was missing its `play/index.ts`
   barrel line (no test enforces play-barrel completeness, so nothing would have caught it); the two
   new store helpers were declared below the `create()` call and took `(get, set, …)` where the
   helper they name as their model takes `(set, get, …)`; and the rewritten `**Validates:**` header
   carried Requirements 21.1-21.5 forward from the old one — Component Library Architecture, which
   cannot apply to a pure engine module. Now cites Requirement 11.5.
10. **Also corrected in [CLAUDE.md](../../../CLAUDE.md):** the derived-values hard rule claimed
    `Character.currentStatValues` was "the one sanctioned exception". The field name was already
    stale (it is `currentResourceValues`), and this ticket makes it two.

## Verification (2026-08-16)

- `npx vitest run` — 1356 passing, 0 failing, 0 skipped (baseline 1320 after SKL-03; +36 here).
- `npx tsc --noEmit` — the 2 documented baseline errors, nothing new.
- `yarn run check` — clean. **One lint regression was introduced and fixed**: `ExperienceControl`
  hardcoded a static element `id` instead of `useId()`, which every sibling in the repo already
  uses — caught by the `verifier` subagent, and a pre-commit blocker either way.
- `fallow audit --base HEAD` — verdict **pass**, 0 introduced dead-code, complexity or duplication
  findings.
