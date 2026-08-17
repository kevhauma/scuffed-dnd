# TICKET-ROLL-04 — Ladder rolling and notation

- **Area:** Dice & rolls
- **Type:** Feature (engine, no UI)
- **Traceability:** Concept [07 · Dice ladder](../../excel%20export%20summary/concepts/07-dice-ladder.md) (rolling, formatting)

## User story

As a Player, I want a decomposed pool to roll fairly and print the way the sheet prints it —
`1D20 + 1D12 + 1D6 + 1`, descending, flat included — so what I read is what I roll.

## Description

The second half of the ladder engine: rolling arbitrary-size pools with the injectable RNG
convention, and ladder-driven notation. Consumers arrive with ROLL-05/06.

## Current situation (as-is)

- [`diceSimulator.ts`](../../../src/engine/dice/diceSimulator.ts) rolls only the six hardcoded
  die types; [`formatDiceNotation`](../../../src/engine/dice/diceSimulator.ts) strips zero-count
  terms, ascends d4→d20, and omits the flat term — each the opposite of the seed ladder's
  rendering.

## Desired result (to-be)

- `rollDecomposition(decomposition, rng?)` — per-die results within `[1, size]` for arbitrary
  sizes, plus flat and total; `RandomSource` injectable, defaulting to `Math.random`, per the
  established convention (randomness stays out of formulas and decomposition).
- Ladder-driven notation: descending sizes, flat term always rendered (`+ 4`), zero rungs
  per the ladder's `showZeroTerms` — one formatting function, the single notation definition for
  ladder pools.
- The legacy `DiceConfig` surface stays untouched until ROLL-06 deletes it — both notations
  coexist knowingly, each with one owner.

## Implementation notes

1. **Both functions live in `diceLadder.ts`, beside `decomposeValue`**, rather than in a new
   module. They are the same concept — a ladder decomposes, rolls and prints — and splitting them
   would put `showZeroTerms` in one file and the rung order it applies to in another. The module
   docblock is retitled from *Dice Ladder Decomposition* to *Dice Ladder* to say so.
2. **`rollDecomposition` takes a decomposition, not a value and a ladder.** That is the
   `rollCombatSkill` rule applied here: a roll must not be able to disagree with what the sheet
   displayed, so the same `LadderDecomposition` object is shown and rolled rather than each side
   deriving its own. It reuses `rollDie`/`RandomSource` from
   [`diceSimulator.ts`](../../../src/engine/dice/diceSimulator.ts) — `rollDie` already takes an
   arbitrary `sides`, so there is no second definition of "roll a die".
3. **A rung with no dice is still an entry in the roll result**, matching `decomposeValue` and
   *not* matching `rollDice`, which omits a zero-count die type. Whether `0D20` is shown is
   `showZeroTerms`'s decision at display time; the older function had no such flag to defer to.
4. **`formatLadderNotation` does not sort.** It prints the decomposition's existing order, which is
   the ladder's own. A misordered ladder is `engine/validator.ts`'s error to report, and sorting
   here would be a second opinion that quietly disagrees with the report.
5. **A negative flat renders as `- 7`, not `+ -7`.** It only arises from an input the ladder could
   not take apart (ROLL-03's flat-only path), but it still has to read as arithmetic.

## Acceptance criteria

- [x] Property test: every die result within bounds, totals = Σ results + flat, across arbitrary ladders (alongside the existing dice property tests). (`diceLadder.test.ts` › `should keep every die within its own bounds and total to the sum plus the flat`, over an `arbitraryLadder` generator — `fc.uniqueArray` sorted descending, so the *ladder* varies rather than only the value. That is deliberate: ROLL-03's properties swept values against one fixed ladder, which is exactly how the `NaN`-size defect the conventions review found got past them.)
- [x] Notation snapshots as strings: `showZeroTerms` on (`0D20 + 0D12 + 1D6 + 4`) and off (`1D6 + 4`); descending order pinned. (Three cases each way in `diceLadder.test.ts` › `formatLadderNotation`, using Concept 07's own values — 10, 39 and 18 — so the strings are the sheet's rather than invented. Plus the flat-alone case and the negative flat. Descending order is pinned by `should print rungs in the ladder order it was given, without sorting them`, which asserts a *misordered* ladder prints misordered.)
- [x] RNG injection tested without spying on `Math.random`. (`should take its randomness from the injected source, never from Math.random` passes a local `sequenceRng`; the property test passes a generated draw sequence. No `vi.spyOn` anywhere in the file.)
- [x] Existing dice tests untouched and green. (`git diff` touches neither `diceSimulator.test.ts` nor `combatRoll.test.ts`; both green — 13 and 8 cases.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Full suite 1536/1536, 0 skipped; `tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit --base HEAD` introduced **nothing** — 0 dead code, 0 complexity, 0 duplication. The `conventions-reviewer` returned no blocking findings; its two nits were applied — the split type/value import combined to match `combatRoll.ts`, and the two new fixtures moved up beside `sheetLadder` so the fixture block is one region — and its two forward-looking notes are recorded below.)

## Notes

- Mirrors v1.0's ROLL-01 pattern: engine landed and verified before any UI consumes it.
- **No sheet fragment**: this ticket adds no persisted entity and reshapes none — `DiceLadder`
  landed with TICKET-ROLL-03 and `docs/imports/dice-ladders.json` with it. Rolling and notation are
  behaviour over a shape that already ships its data.

### Two things handed forward to TICKET-ROLL-05

Both raised by the `conventions-reviewer` on this diff. Neither is a defect here — nothing calls
either function yet — and both become real the moment a roll definition feeds a formula result in.

1. **`DieRollResult` is one character from `DiceRollResult`** (`types/formula.ts`), and both are
   barrelled — `engine/dice/index.ts` and `types/index.ts` — so a consumer can import both and
   pick the wrong one. Knowingly temporary: ROLL-06 deletes the older type with `DiceConfig`. If
   ROLL-05 finds the pair genuinely confusing at a call site, rename there rather than churning
   this module twice.
2. **`rollDecomposition` allocates one array entry per die, with no ceiling.** `decomposeValue` is
   O(rungs) and total, but rolling is O(Σ count): a ladder with no `maxPerDie` and a smallest rung
   of 2, handed a formula result in the millions, builds a multi-hundred-thousand-element array.
   ROLL-05 is where a value first reaches this from a formula, so the decision belongs there — a
   `maxPerDie` recommendation from the validator, or a cap at the call site.
