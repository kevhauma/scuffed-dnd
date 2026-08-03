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

- [ ] Award/Deduct persist through store actions; XP never resets, has no max, and deducting below 0 is refused (tests).
- [ ] Level tracks the curve at boundaries: exactly at a threshold, one below, extrapolated beyond the last row (tests).
- [ ] No other definition of level remains (grep: nothing sums `investedStatPoints` for display).
- [ ] Header display composes `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: award XP across a threshold, watch the level change. (Ask the User first per CLAUDE.md.)

## Notes

- Real thresholds are open question #8 — the CRV-03 seed ships the shape; the User tunes rows.
- Data-driven Actions (`operation`/`condition`/`confirm` as records) arrive when spells need
  them; v2.0 ships the seed behaviours as plain store actions.
