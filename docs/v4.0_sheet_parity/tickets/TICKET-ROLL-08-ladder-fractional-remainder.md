# TICKET-ROLL-08 — The dice ladder's fractional remainder

- **Area:** Rolls & combat
- **Type:** Bug / engine behaviour
- **Traceability:** System [07 · Combat rolls](../systems/07-combat-rolls.md); overview
  [D3](../overview.md#d3--formulas-are-captured-and-one-display-trap-is-on-record). The scaler
  half of v2.0's oldest open question (Concept 08) closes with the data pass.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the three combat-scaler constants and the two corrected roll-input formulas are seeded values and
> formula text, so they are the data pass's. It owes this ticket:
> `evasion_speed_divisor` 5, `endurance_health_divisor` 5, `endurance_body_divisor` 2.5 in
> [constants.json](../../imports/constants.json) (sheet labels recorded, `Background References
> Character` S3:U4); evasion = `stats.dex + stats.speed / const.evasion_speed_divisor` and
> Endurance = `(stats.strenght + stats.con) / const.endurance_body_divisor + stats.health /
> const.endurance_health_divisor` in [roll-definitions.json](../../imports/roll-definitions.json)
> (`Background Charater Sheet Calcu` AB2:AG8), losing their two "honestly short" notes; and the
> display rename `endure` → `Endurance`.

## User story

As a Player, I want a roll whose input works out to 22.4 to decompose the way the sheet decomposes
it, so a fractional scaler does not quietly change my dice.

## Description

Once the data pass lands the real scalers, roll inputs stop being integers: the sheet's Endurance
sample is **22.4**. The ladder ([diceLadder.ts](../../../src/shared/engine/dice/diceLadder.ts),
TICKET-ROLL-03) has never been exercised on a fractional input, and its flat remainder is where the
fraction lands. The sheet `ROUND`s that remainder — 22.4 → `1D20 + 2` — and Excel's `ROUND` breaks
`.5` **away from zero**, which JavaScript's `Math.round` matches for positives and does not for
negatives. This ticket settles the ladder's behaviour before any fixture pins a number that depends
on it.

## Current situation (as-is)

- The ladder is confirmed unchanged by the new workbook: `INT(value/20)` D20s, `INT` D12s, `INT`
  D6s, remainder to the flat term, zero terms written out.
- Its inputs have always been integers, so the remainder has always been one. Nothing in the suite
  says what a `.5` or a `.4` should do, and nothing says what a negative input should do either.
- Roll inputs are User-authored formula text at the `roll-input` attachment point
  (TICKET-ROLL-05), edited with `FormulaEditor` + `FormulaPreview` — the surface is in place; only
  what the ladder does with a fractional result is open.

## Desired result (to-be)

- **The rounding is stated and pinned**: the flat remainder rounds the way the sheet's `ROUND(…, 0)`
  does, `.5` away from zero, negatives included — one rule, in the ladder, named in its module
  header with the cell it came from.
- **If the app's current behaviour differs, the delta goes to the User before it is pinned** — this
  is a rule about everyone's existing rolls, not a fresh choice.
- **No formula, constant or fragment moves here** (D7): this ticket is the ladder and its tests.

## Acceptance criteria

- [ ] 22.4 decomposes to `1D20 + 0D12 + 0D6 + 2` through the real ladder — pinned, and the four
      sample decompositions re-pinned as a set once the data pass supplies the inputs (this ticket
      pins them from a fixture of its own).
- [ ] The `.5` case is pinned in both directions (`x.5` up, `-x.5` away from zero) and the module
      header names Excel's `ROUND` as the rule it implements.
- [ ] Whole-number inputs decompose exactly as they do today — the existing `diceLadder` suite
      passes unmodified, which is what proves this is additive.
- [ ] If current behaviour differs from the sheet's, the difference is surfaced to the User and the
      chosen answer is recorded in this ticket before the test is written.
- [ ] Derived values still come from the engine; no caller rounds an input before handing it over —
      a grep for pre-rounding at the call sites stays empty.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill. (Engine-only; offer the User a browser look at a fractional roll once the data pass
      makes one reachable.)

## Notes

- Whether the new formulas also explain the *old* sheet's cells (evasion 18 at Dex 11) is nice to
  know, not required — systems/07 records the check.
- This ticket is additive engine behaviour, so it raises no `SUPPORTED_SCHEMA_VERSION`; the
  milestone's single bump belongs to whichever reshaping ticket lands first (overview
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)).
