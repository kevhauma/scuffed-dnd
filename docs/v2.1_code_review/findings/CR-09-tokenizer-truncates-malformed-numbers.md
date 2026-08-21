# CR-09 — The tokenizer silently truncates malformed number literals

**Severity:** Medium · **Area:** engine (formula parser) · **Type:** correctness bug
**Status:** Confirmed by executable repro

## Summary

The number tokenizer consumes `[0-9.]*` and hands the result to `parseFloat`, so a second `.` in
a literal is silently dropped instead of being a syntax error: `1.2.3` parses as `1.2`, and
`1..5 + 2` evaluates to `3`. `validateFormula('1.2.3')` reports `isValid: true`.

## Evidence

- `src/engine/formula/parser.ts:122` — `[0-9.]*` consumption + `parseFloat`.
- **Repro (executed):** `1.2.3` → valid, evaluates `1.2`; `1..5 + 2` → `3`.

## Impact

This is exactly the "confident wrong number" the engine's errors-as-values discipline everywhere
else exists to prevent: a typo'd literal produces a plausible result instead of a refusal, and the
User has no signal their ruleset math is off.

## Suggested direction

Track whether a `.` has been seen while consuming the literal; a second `.` (or a trailing
bare `.`) becomes a tokenizer error with the offending span. Add `1.2.3`, `1..5`, `1.`, and `.5`
(decide the last one's fate explicitly) to the parser tests.
