# TICKET-FORM-07 — Exponentiation in the formula engine

- **Area:** Formula engine
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md) (the XP generator); spec §5.3 (function library)

## User story

As a User, I want to raise a number to a power in a formula, so a progression can curve instead of
only ever being a straight line.

## Description

The engine's arithmetic is `+ - * /` and nothing else, so every generator and every derived value
is limited to a linear or piecewise-linear shape. That is the one thing standing between
TICKET-CRV-02's generators and the progression Concept 06 actually specifies.

## Current situation (as-is)

- [`parser.ts`](../../../src/engine/formula/parser.ts)'s grammar has four binary operators
  (`PLUS`, `MINUS`, `MULTIPLY`, `DIVIDE`) across two precedence levels, and
  [`types/formula.ts`](../../../src/types/formula.ts)'s `BinaryOpNode` types `operator` as
  `'+' | '-' | '*' | '/'`. A `^` character reaches the tokenizer's `default` branch and throws
  `Unexpected character '^'`.
- The closed library in [`functions.ts`](../../../src/engine/formula/functions.ts) is
  `round`/`roundup`/`rounddown`/`floor`/`ceil`/`min`/`max`/`clamp`/`abs` — no `pow`, and spec §5.3
  lists none either.
- **The consequence, found by TICKET-CRV-02** (implementation note 5): Concept 06's own seed
  generator, `round(const.xp_base * level ^ const.xp_exponent)`, cannot be written. Any XP curve is
  currently a hand-typed table or a straight line, which is the opposite of that page's point —
  "a generator makes the shape editable in one place rather than row by row".

## Desired result (to-be)

- Exponentiation is expressible. **Two candidate spellings, and this ticket carries the decision:**
  a `^` operator (matches the spec text and the sheet, needs a new precedence level and is
  right-associative), or a `pow(base, exponent)` library function (no grammar change, no
  associativity question, but reads worse in the formula Concept 06 quotes).
- Whichever is chosen: the parser or library accepts it, `validateFormula` reports its misuse the
  way it does for every other operator/function, and evaluation returns an **error value** rather
  than `NaN` or `Infinity` for the cases that have no number — a negative base with a fractional
  exponent, and `0 ^ negative`.
- Concept 06's XP generator is writable end to end: `round(const.xp_base * key ^ const.xp_exponent)`
  saves, validates, and regenerates a curve column.

## Acceptance criteria

- [ ] The decision above is recorded in the ticket before implementation, with the reason.
- [ ] Parsing is tested for precedence against `*` and `+`, for right-associativity if an operator (`2 ^ 3 ^ 2` is 512, not 64), and for unary minus (`-2 ^ 2`) — whichever cases the chosen spelling makes reachable.
- [ ] `NaN`/`Infinity` cannot escape: a negative base with a fractional exponent and `0 ^ negative` each return a named `FormulaError`, tested through `evaluateFormulaString`, per Concept 00 §7 and the rule TICKET-CRV-01 established for missing curve cells.
- [ ] Concept 06's XP generator round-trips: it validates against the `curve-generator` scope and `regenerateCurve` fills a column with it (test in `curveGenerator.test.ts`).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- **Blocks nothing yet, but blocks [TICKET-RES-01](./TICKET-RES-01-xp-and-derived-level.md)** from
  being more than a hand-typed table. TICKET-CRV-03 seeds the XP curve's *shape* rather than
  invented numbers (open question #8), so it can land first either way.
- If `^` wins, `BinaryOpNode['operator']` widens and the evaluator's `switch` gains an arm — the
  two `never` typecheck errors in `TEST_STATUS.md` live in exactly that switch, so check whether
  they move or resolve rather than assuming.
- Deliberately out of scope: roots, logs, and any other maths. The sheet uses one power.
