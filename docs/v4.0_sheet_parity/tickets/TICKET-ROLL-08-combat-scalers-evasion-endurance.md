# TICKET-ROLL-08 — Combat scalers: evasion and Endurance made whole

- **Area:** Rolls & combat
- **Type:** Feature (data + formula revision)
- **Traceability:** System [07 · Combat rolls](../systems/07-combat-rolls.md); overview
  [D1](../overview.md#d1--the-new-workbook-replaces-the-old-one-as-the-source-of-truth) /
  [D3](../overview.md#d3--formulas-are-captured-and-one-display-trap-is-on-record). Closes v2.0's
  oldest open question (Concept 08, held open by TICKET-DX-04).

## User story

As a Player, I want my evasion and Endurance rolls to read the inputs the sheet actually computes —
Dex + Speed/5, and (Strenght + Con)/2.5 + Health/5 — so my defensive rolls scale with my whole
build instead of one bare stat.

## Description

The new workbook finally shows the evasion and endure inputs whole, read from live formulas. Three
new constants and two corrected roll formulas replace the deliberately-short inputs v2.0 shipped
with an honest note. The ladder itself is unchanged.

## Current situation (as-is)

- [roll-definitions.json](../../imports/roll-definitions.json) ships evasion and `endure` reading
  the **bare stat** (`stats.dex`, `stats.con`), each with a note saying the old sheet's cells
  carried unexplained extra terms (TICKET-ROLL-05/06). The new xlsx's formulas
  (`Background Charater Sheet Calcu` AB2:AG8) settle both.
- [constants.json](../../imports/constants.json) has no combat-scaler constants; the sheet's
  *Combat scaler* block (`Background References Character` S3:U4) holds three: Speed 5, Healt 5,
  strengt/con 2.5.
- The ladder ([diceLadder.ts](../../../src/shared/engine/dice/diceLadder.ts), TICKET-ROLL-03) is
  confirmed unchanged, but its flat-remainder handling has never been checked against a
  **fractional** input — the sheet `ROUND`s the remainder (22.4 → `1D20 + 2`, and a `.5` remainder
  rounds *up*).
- Roll inputs are already User-authored formula text at the `roll-input` attachment point
  (TICKET-ROLL-05), edited with `FormulaEditor` + `FormulaPreview` — so this is the "formula edit
  once the live rows are read" the fragment predicted, not a new field.

## Desired result (to-be)

- **Three new constants** in the corpus and seeds: `evasion_speed_divisor` 5,
  `endurance_health_divisor` 5, `endurance_body_divisor` 2.5 (names ours; the sheet's labels are
  recorded in the fragment).
- **Two corrected roll inputs**: evasion =
  `stats.dex + stats.speed / const.evasion_speed_divisor`; Endurance =
  `(stats.strenght + stats.con) / const.endurance_body_divisor + stats.health / const.endurance_health_divisor`
  — plus the display rename `endure` → `Endurance` (id stable, TICKET-REF-01).
- **Fragments re-sourced**: roll-definitions.json loses its two "honestly short" notes and cites
  the new xlsx ranges; dice-ladders.json re-sourced unchanged; the ladder's fractional-remainder
  behaviour confirmed against the sheet's `ROUND` before plan §15 pins fixtures.

## Acceptance criteria

- [ ] The four sample decompositions reproduce through the engine: Mele 26 → `1D20 + 0D12 + 1D6 + 0`,
      Ranged 9 → `0D20 + 0D12 + 1D6 + 3`, Evasion 13 → `0D20 + 1D12 + 0D6 + 1`, Endurance 22.4 →
      `1D20 + 0D12 + 0D6 + 2` (engine tests against the seeded ruleset).
- [ ] A fractional remainder rounds the way the sheet's `ROUND(…, 0)` does, including the `.5`-up
      case, pinned by a `diceLadder` test — or, if the app's current behaviour differs, the delta is
      surfaced to the User before anything is pinned.
- [ ] The three constants exist as ordinary `Constant` rows in seeds and corpus; the two roll
      formulas evaluate through `parseFormula` → `evaluateFormula` — no hand-rolled arithmetic.
- [ ] Editing either roll input still renders `FormulaPreview` with the `roll-input`
      `FormulaOwner` — this ticket changes shipped formula *text*, not the editing surface.
- [ ] [roll-definitions.json](../../imports/roll-definitions.json),
      [dice-ladders.json](../../imports/dice-ladders.json) and
      [constants.json](../../imports/constants.json) re-sourced to the new workbook with
      `source.ranges` cited (xlsx names, typos intact) and new `exportedAt`; `yarn run sheet:import`
      regenerated.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the two rolls on a seeded character (ask the User first).

## Notes

- The ladder itself does not change — `INT(value/20)` D20s, `INT` D12s, `INT` D6s, remainder to
  the flat term, zero terms written out. Only the remainder's rounding needs confirming.
- Whether the new formulas also explain the *old* sheet's cells (evasion 18 at Dex 11) is nice to
  know, not required — systems/07 records the check.
- First v4.0 ticket to land raises `SUPPORTED_SCHEMA_VERSION` once for the milestone; the rest
  inherit it (overview [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)).
  This ticket is additive-data only, so if it lands first the bump may not be needed yet — say so
  explicitly when closing it.
