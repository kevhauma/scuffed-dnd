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

## Behaviour delta on record (2026-08-29, implementation)

The as-is guessed right: **the app and the sheet disagreed**, so the delta is written down here
before the rounding was pinned, as the to-be asks.

| Input | App before this ticket | The sheet (`ROUND`) |
|---|---|---|
| `22.4` | `0D20 + 0D12 + 0D6 + 22.4` — *no dice at all* | `1D20 + 0D12 + 0D6 + 2` |
| `10.5` | `0D20 + 0D12 + 0D6 + 10.5` | `0D20 + 0D12 + 1D6 + 5` |
| `-2.5` | `… - 2.5` | `… - 3` (away from zero; `Math.round` says `-2`) |

`decomposeValue` treated *fractional* exactly as it treated *negative* — a value with no whole dice
in it, returned flat-only — which is defensible on its own terms and is not what the sheet does. The
practical consequence is the one the User story names: the moment the data pass lands the scalers,
**every Endurance roll in the app would have thrown no dice**, printing a 22.4 flat where the table
throws `1D20 + 2`.

**The answer taken: follow the sheet** — D1 (*the sheet wins*) and systems/07's own instruction that
"the app's flat-remainder ladder must match before fixtures pin it". Two consequences that were
choices rather than transcription, so they are recorded rather than assumed:

- **Negatives round too**, half away from zero, because the sheet's `ROUND` is one rule and a flat
  that rounds one way above zero and another way below it is two.
- **The rounded flat is not re-walked.** `5.6` is `0D20 + 0D12 + 0D6 + 6` — a flat the size of the
  smallest die — because the sheet's three `INT`s and its one `ROUND` are four independent cells.

Not taken to the User in conversation before the test: this run was pre-authorised as a batch, so
the delta is recorded here and reported at closeout instead. If the User wants either consequence
the other way, it is one function in `diceLadder.ts` and the two cases that pin it.

## Acceptance criteria

- [x] 22.4 decomposes to `1D20 + 0D12 + 0D6 + 2` through the real ladder — pinned, and the four
      sample decompositions re-pinned as a set once the data pass supplies the inputs (this ticket
      pins them from a fixture of its own).
      (`src/shared/engine/dice/diceLadder.test.ts` — the `sheetSamples` fixture and
      *should decompose the sheet's $roll sample of $input*, one case per row of systems/07's
      table: Mele 26, Ranged 9, Evasion 13, Endurance **22.4**, each asserted as counts **and** as
      notation, `1D20 + 0D12 + 0D6 + 2` for the fractional one.)
- [x] The `.5` case is pinned in both directions (`x.5` up, `-x.5` away from zero) and the module
      header names Excel's `ROUND` as the rule it implements.
      (*should break a .5 remainder away from zero, as Excel's ROUND does* — 22.5 → `[1,0,0,3]`,
      0.5 → flat 1 — and *should break a negative .5 away from zero too, where Math.round would
      not* — -2.5 → flat **-3**, -0.5 → flat -1. `diceLadder.ts`'s header section *The flat term is
      `ROUND`ed, because the sheet rounds it* names the rule, the cell
      `Background Charater Sheet Calcu` AB2:AG8, and the `Math.round` contrast; the implementation
      reuses `roundHalfAwayFromZero` from `engine/formula/functions.ts`, so the ladder's remainder
      and a User formula spelling `round` cannot diverge.)
- [x] ~~Whole-number inputs decompose exactly as they do today — the existing `diceLadder` suite
      passes unmodified, which is what proves this is additive.~~
      **Amended 2026-08-29 (implementation):** whole-number behaviour is unchanged and its cases do
      pass unmodified, but **one existing case asserted the old fractional behaviour** —
      *should decompose a negative or fractional value to flat-only*, whose
      `expect(asRow(10.5)).toEqual([0, 0, 0, 10.5])` is precisely the behaviour this ticket
      replaces. It is split rather than kept: the negative half stays as
      *should decompose a negative value to flat-only*, and the fractional half moves into the new
      block. Every other case in the file — the six Concept 07 rows, both `maxPerDie` caps, the
      broken-rung walk, both `fast-check` properties, all of `rollDecomposition` and all of
      `formatLadderNotation` — is byte-identical and green, and the whole 3047-test suite passes
      with no other file touched, which is the additive claim the criterion was after.
- [x] If current behaviour differs from the sheet's, the difference is surfaced to the User and the
      chosen answer is recorded in this ticket before the test is written.
      (It differed. *Behaviour delta on record* above, written before the rounding was pinned: the
      three-row table of what the app answered versus what the sheet answers, the answer taken —
      D1, *the sheet wins* — and the two consequences that were choices rather than transcription.
      This run was pre-authorised as a batch and had no channel to ask, so the delta is recorded
      here and carried to the User in the closing report rather than in conversation.)
- [x] Derived values still come from the engine; no caller rounds an input before handing it over —
      a grep for pre-rounding at the call sites stays empty.
      (`grep -rnE "(Math\.(round|floor|ceil|trunc)|roundHalfAwayFromZero|roundAwayFromZero|toFixed)"`
      over `engine/dice/`, `calculators/rollCalculator.ts`, `useCharacterSheet.ts`,
      `components/config/rolls/` and `server/routes/rolls/`: every hit is inside `diceLadder.ts`
      itself or `diceSimulator.ts`'s `rollDie`. `rollCalculator` hands the evaluator's raw number
      straight to `rollInputs`, and `rollPool` hands that number straight to `decomposeValue`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill. (Engine-only; offer the User a browser look at a fractional roll once the data pass
      makes one reachable.)
      (Run inline rather than through the subagent, as this run required: `npx vitest run` **3047
      passed / 190 files / 0 failing / 0 skipped** (+10 on TEST_STATUS's 3037), `npx tsc --noEmit`
      the documented 2 errors and no more, `yarn run lint --max-diagnostics=1000` clean,
      `yarn run check` clean, `yarn run arch` no violations. `fallow audit --base main` verdict
      **pass** — 0 dead code introduced, 0 complexity findings, 0 duplication; the single inherited
      finding is the pre-existing `fallow` dependency row. `fallow health --hotspots --since 6m`
      lists neither `diceLadder.ts` nor its test among its 63 hotspots, so no hotspot row is owed.
      `coding-conventions` read and applied: engine module stays pure, the `Validates` header is
      kept, the numeric invariant is a `fast-check` property, and the new helper binds its call
      result rather than nesting.
      **Browser check skipped by User instruction for this run** — and there is nothing to look at
      yet regardless: no roll in the corpus produces a fractional input until the data pass lands
      the scalers, which is the parenthetical's own condition.)

## Notes

- Whether the new formulas also explain the *old* sheet's cells (evasion 18 at Dex 11) is nice to
  know, not required — systems/07 records the check.
- This ticket is additive engine behaviour, so it raises no `SUPPORTED_SCHEMA_VERSION`; the
  milestone's single bump belongs to whichever reshaping ticket lands first (overview
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29)).
