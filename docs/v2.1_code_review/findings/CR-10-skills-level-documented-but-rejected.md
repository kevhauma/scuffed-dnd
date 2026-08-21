# CR-10 — `skills.<name>.level` is documented as valid in four places but rejected at evaluation

**Severity:** Medium · **Area:** engine (formula) · **Type:** doc/behavior mismatch

## Summary

The skills namespace resolver only accepts the property `bonus`, but the grammar docs, the
references module, and the roll calculator all present `.level` as a valid member. Scope
validation checks namespace+member presence only, so a formula using `.level` saves and then
errors at read time — with an error message that itself implies `.level` should work.

## Evidence

- `src/engine/formula/skills.ts:56-61` — only `bonus` accepted; `skills.stealth.level` returns
  `unknown-member` with the message "a skill has a level and a bonus".
- Documentation presenting `.level` as valid: `src/engine/formula/parser.ts:28` and `:365`,
  `src/engine/formula/references.ts:7` and `:269` ("`skills.STL.level` is a fixed field"),
  `src/engine/calculators/rollCalculator.ts:40` ("a roll reads `skills.<name>.level` and
  `.bonus`").

## Impact

A User following the engine's own documentation authors a formula that validates, saves, and then
fails on the sheet. Four doc sites and one resolver disagree about the public formula surface.

## Suggested direction

Decide the contract once: either accept `level` in the resolver (skill level is already computed
and available where bonuses are), or fix the four documentation sites and the misleading error
message. Accepting `.level` matches the roll calculator's stated model and is the smaller
surprise.
