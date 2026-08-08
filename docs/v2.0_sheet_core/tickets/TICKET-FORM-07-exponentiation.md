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

## Decision (2026-08-08, by the User)

**The `^` operator**, not a `pow()` function. It is what the spec text and the source sheet
already write, and it is what Concept 06's generator is quoted in — a `pow(const.xp_base, …)`
rewrite would make the app's formula language differ from its own documentation on the one
expression that documentation is built around.

Two consequences settled with it. **They follow different authorities, on purpose** — the
correction below was made after the first draft of this note got the Excel behaviour wrong:

- **Unary minus binds tighter**, so `-2 ^ 2` is 4, not −4. This is Excel and Google Sheets
  behaviour, and it is what this codebase already commits to elsewhere: `round` is Excel's
  half-away-from-zero rather than JavaScript's. Agreeing with the source sheet matters more than
  agreeing with mathematical convention when the User is transcribing formulas out of it. It falls
  out of the existing grammar for free — unary sits inside `factor`, which binds tighter than the
  new power level.
- **Right-associative**, so `2 ^ 3 ^ 2` is 512. This is the mathematical reading and what most
  programming languages do (Python, Ruby, JavaScript's `**`). **Excel is left-associative here and
  would answer 64.** The first version of this note claimed the opposite — "the reading every
  spreadsheet uses" — which is simply false, and it matters because it made the two decisions look
  consistent when they are not.

  Kept right-associative anyway, on the merits rather than on a false premise: chained
  exponentiation is vanishingly rare in a ruleset (no seed curve or concept page uses one), while
  `-x ^ 2` is the shape a User actually types. Where the sheet's reading is the one people hit, it
  wins; where neither is likely to come up, the less surprising default across languages wins.
  **Cheap to reverse** — it is the direction of one recursion in `power()` — so say if you would
  rather have Excel parity on both.

## Implementation notes (2026-08-08)

1. **The finiteness guard had to widen past `^`, and the first version of this ticket overclaimed.**
   The criterion below says "`NaN`/`Infinity` cannot escape"; the first implementation guarded only
   `^` and `/`, and the module JSDoc asserted the invariant anyway. It was false:
   `10 ^ 200 * 10 ^ 200` overflows on the **multiply**, and `round(…)` of it passes an `Infinity`
   straight through the library. Before this ticket that was near-unreachable — the tokenizer has
   no exponent literal, so reaching `1e308` needed a contrived chain — but `^` makes it a one-liner
   a plausible ruleset hits by accident. Every operator and every library call now goes through one
   `finite` helper, and a `fast-check` property pins the invariant rather than six examples of it.
2. **The two typecheck errors in `evaluator.ts` are gone**, and not by suppression. They were the
   `default` arm narrowing `ast` itself to `never`; taking the operator as a *parameter*
   (`applyBinary`, `applyUnary`) narrows the parameter instead, so `const _exhaustive: never =
   operator` compiles. The check got stronger — an unhandled operator is now a compile error rather
   than a runtime throw. `TEST_STATUS.md`'s baseline drops 4 → 2.
3. **`FormulaEditor`'s autocomplete tokenizer needed `^` too.** It splits on operator characters to
   find the word being typed; without `^` in the class, `STR^D` is one word and suggestions
   silently stop after a tightly-typed power.

## Acceptance criteria

- [x] The decision above is recorded in the ticket before implementation, with the reason. (The section above, written before any code changed — though its Excel claim was wrong and is corrected there, which is why the correction is visible rather than quietly rewritten.)
- [x] Parsing is tested for precedence against `*` and `+`, for right-associativity if an operator (`2 ^ 3 ^ 2` is 512, not 64), and for unary minus (`-2 ^ 2`) — whichever cases the chosen spelling makes reachable. (`parser.test.ts` "Exponentiation (TICKET-FORM-07)" — "should bind tighter than multiplication" (`2 * 3 ^ 2` nests the power on the right of the `*`), "should bind tighter than addition", "should be right-associative" (`2 ^ 3 ^ 2` nests right, so 512), "should let unary minus bind tighter, as a spreadsheet does" (`-2 ^ 2` parses as `(-2) ^ 2`), "should accept a negative exponent", "should take references and calls as operands", "should let parentheses override the associativity". The grammar gained one level — `term := power ((*|/) power)*`, `power := factor (POWER power)?` — so unary binding tighter falls out of `factor` rather than being special-cased.)
- [x] `NaN`/`Infinity` cannot escape: a negative base with a fractional exponent and `0 ^ negative` each return a named `FormulaError`, tested through `evaluateFormulaString`, per Concept 00 §7 and the rule TICKET-CRV-01 established for missing curve cells. (**Scope widened while building — see implementation note 1.** The `^`-specific cases: `evaluator.test.ts` "Exponentiation (TICKET-FORM-07)" — "should refuse a negative base under a fractional power" (`-8 ^ 0.5` → `not-evaluable`, "no real value"), "should refuse zero under a negative power as the division by zero it is" (`0 ^ -1` → `division-by-zero`, reusing the existing kind because that is what it is), "should refuse a result too large to represent" (`10 ^ 400`). The *general* invariant: "no arithmetic result escapes as NaN or Infinity (TICKET-FORM-07)" — six overflow expressions that fail one operator past `^` (`10 ^ 200 * 10 ^ 200`, its subtraction, its `* 0`, `10 ^ 200 / (10 ^ -200)`, and `round(…)` of it) each refused, plus a `fast-check` property over 500 generated expressions asserting that any arithmetic the grammar can build returns either a `FormulaError` or a finite number. Values: "should raise a number to a power", "should evaluate the associativity the parser gives it", "should evaluate the precedence the parser gives it".)
- [x] Concept 06's XP generator round-trips: it validates against the `curve-generator` scope and `regenerateCurve` fills a column with it (test in `curveGenerator.test.ts`). (`curveGenerator.test.ts` "Concept 06's XP generator (TICKET-FORM-07)" — the page's own `round(const.xp_base * key ^ const.xp_exponent)` fills five rows as 100/400/900/1600/2500, "should reshape the whole table from one constant, which is the point" moves the exponent 2 → 1.5 and the whole column follows, and "should keep a hand-tuned early game while the generator produces the rest" combines it with CRV-02's override. Reference round-trip: `references.test.ts` "resolves references either side of a power operator" — `STR ^ 2 + DEX` stores and re-displays intact, which it could not before, since the tokenizer threw on `^`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (**1040 passing, 0 failing, 0 skipped** (from 1013), `npx tsc --noEmit` at **2** errors — down from 4, see implementation note 2 — and `yarn run check` clean over 244 files. fallow `audit --base HEAD`: **0 introduced dead code, duplication or complexity**; splitting the evaluator's switch also dropped its inherited complexity findings from 7 to 1. conventions-reviewer confirmed layering, engine purity, the formula-engine rule, the precedence/associativity implementation at runtime, and that the typecheck improvement is a real strengthening rather than a suppression — and found six things, **all addressed**: the `NaN`/`Infinity` hole and its overclaiming comment (note 1, now with a property test); the false "every spreadsheet" justification for right-associativity, corrected in the decision note, the parser JSDoc and `project-map`; `FormulaEditor`'s tokenizer (note 3); `ONBOARDING.md`'s stale operator list; this criterion's placeholder evidence; and `TEST_STATUS.md`'s line endings, which had flipped CRLF → LF and made a 15-line change read as a 131-line diff.)

## Notes

- **Blocks nothing yet, but blocks [TICKET-RES-01](./TICKET-RES-01-xp-and-derived-level.md)** from
  being more than a hand-typed table. TICKET-CRV-03 seeds the XP curve's *shape* rather than
  invented numbers (open question #8), so it can land first either way.
- If `^` wins, `BinaryOpNode['operator']` widens and the evaluator's `switch` gains an arm — the
  two `never` typecheck errors in `TEST_STATUS.md` live in exactly that switch, so check whether
  they move or resolve rather than assuming.
- Deliberately out of scope: roots, logs, and any other maths. The sheet uses one power.
