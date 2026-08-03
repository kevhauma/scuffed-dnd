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

## Acceptance criteria

- [ ] Property test: every die result within bounds, totals = Σ results + flat, across arbitrary ladders (alongside the existing dice property tests).
- [ ] Notation snapshots as strings: `showZeroTerms` on (`0D20 + 0D12 + 1D6 + 4`) and off (`1D6 + 4`); descending order pinned.
- [ ] RNG injection tested without spying on `Math.random`.
- [ ] Existing dice tests untouched and green.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Mirrors v1.0's ROLL-01 pattern: engine landed and verified before any UI consumes it.
