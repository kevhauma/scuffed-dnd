# TICKET-FORM-02 — Function calls in the formula engine

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concepts [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (APT), [02 · Skill](../../excel%20export%20summary/concepts/02-skill.md) (bonus rounding); spec [§5.3](../../excel%20export%20summary/ttrpg-app-spec.md)

## User story

As a User, I want formulas to use functions like `round`, `max`, and `clamp`, so the rules the
sheet actually runs on — `max(1, round(SPD / 30))`, `round(level / 5)` — are expressible.

## Description

The parser supports only `+ - * /`, parentheses, unary negation, numbers, and variables; every
confirmed derivation in the concept pages needs at least one function it cannot parse. Purely
additive: every existing formula keeps parsing and evaluating identically.

## Current situation (as-is)

- [`parser.ts`](../../../src/engine/formula/parser.ts) has no comma and no call syntax — `round(x)`
  is a parse error; [`FormulaAST`](../../../src/types/formula.ts) has no call node.
- The engine contains no rounding anywhere; `Math.round` appears only in display code.

## Desired result (to-be)

- Call syntax `name(arg, …)` with a **closed library**: `round`, `roundup`, `rounddown`, `floor`,
  `ceil`, `min`, `max` (variadic ≥ 1), `clamp(x, lo, hi)`, `abs`. No user-defined functions.
- **`round` is half-away-from-zero** (Excel semantics — the sheet's): `round(1.5) = 2`,
  `round(7.5 / 5) = 2`, `round(-0.5) = -1`; `roundup`/`rounddown` round away from / toward zero.
- Unknown function name and wrong arity are named validation errors through `validateFormula`
  (so the `FormulaEditor` primitive accepts the syntax with no separate grammar work).

## Acceptance criteria

- [x] Nested calls parse and evaluate (`max(1, round(SPD / 30))`); precedence interaction tested (`1 + max(2, 3) * 2`). (`parser.test.ts` "should parse nested calls" / "should bind calls tighter than surrounding operators"; `evaluator.test.ts` "evaluates the sheet APT derivation" / "evaluates calls with operator precedence: 1 + max(2, 3) * 2 = 7")
- [x] Rounding semantics pinned by tests: `round(1.5)`, `round(2.5)`, `round(7.5 / 5)`, `round(-0.5)`, plus `roundup`/`rounddown` on negatives. (`evaluator.test.ts` "round — half away from zero (Excel semantics)" and "roundup / rounddown — away from / toward zero" describe blocks — all six pinned values plus `round(-1.5)`, `roundup(-1.2) = -2`, `rounddown(-1.8) = -1`)
- [x] `clamp` and variadic `min`/`max` tested at boundaries; unknown name and bad arity produce named validation errors, not throws. (`evaluator.test.ts` "clamp boundaries" / "variadic min / max"; `validator.test.ts` "Function calls (TICKET-FORM-02)" — `Unknown function: foo`, `round expects exactly 1 argument, got 2`, `clamp expects exactly 3 arguments, got 2`, `max expects at least 1 argument, got 0`, with an explicit `.not.toThrow()` assertion)
- [x] Every pre-existing formula test passes unchanged — no test edited for this ticket. (all test hunks are pure appends — confirmed by `conventions-reviewer` on the diff; suite went 660 → 703 passing, 0 failing, 0 skipped)
- [x] The grammar (including the function list) is documented in `parser.ts` module JSDoc. (`src/engine/formula/parser.ts` module header: full grammar incl. `call :=` production and the nine reserved lowercase names)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (verifier: 703/0/0 tests, tsc at the 4-error baseline — the `evaluator.ts` pair shifted to lines 51/62, TEST_STATUS.md updated — `yarn run check` clean after one Biome auto-fix; fallow audit: 0 introduced dead-code/duplication, 2 introduced complexity findings accepted as the module's established switch-traversal pattern; conventions-reviewer: layering/theme/barrel rules clean. Browser check 2026-08-04 on `/config/stats`: `max(1, round(SPD / 30))` accepted on save, preview = 1 with SPD empty and 2 with SPD 45 (proving `round(1.5) = 2`), and editing to `foo(1) + round(SPD, 2)` showed "Unknown function: foo" + "round expects exactly 1 argument, got 2" in the dialog and refused the save; console error-free.)

## Notes

- Function names are lowercase and reserved; current variables are uppercase codes, so no
  collision — but the tokenizer goes case-sensitive here, and FORM-03 builds on that.
- The spec's logic/aggregation/dice functions are deferred until something needs them
  (`unlock_condition`, spells).
