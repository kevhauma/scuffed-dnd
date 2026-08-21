# CR-02 — Stat formulas may reference `skills.*` at validate/preview time but always fail on the sheet

**Severity:** High · **Area:** engine (formula scoping) · **Type:** correctness bug
**Status:** Confirmed by executable repro

## Summary

The scoping table allows the `skills` namespace in stat formulas, and `FormulaPreview` supplies
skill values for any owner, so a stat formula like `skills.melee.bonus + 1` previews with a real
number and saves without complaint — then errors `Unknown namespace: skills` every time the actual
sheet computes it.

## Evidence

- `src/engine/formula/scoping.ts:62` declares `stat: ['stats', 'skills', 'const', 'curve']`.
- `src/components/config/shared/FormulaPreview.tsx:193-200` supplies `skillLevels`/`skillBonuses`
  regardless of owner, so the preview resolves `skills.*` and shows a number.
- `calculateStatValues` (`src/engine/calculators/statCalculator.ts:254`) builds
  `namespacesFor({ ...source, stats, statValues }, 'stat')` **without** `skillLevels`, so the
  `skills` resolver is absent (`src/engine/formula/namespaces.ts:52-55`).
- **Repro (executed):** the formula validates `isValid: true` and then calculates to an
  `unknown-namespace` error.

## Impact

A "confident wrong preview": the User authors a formula the engine can never honor, with the
preview actively vouching for it. This is not a wiring gap that can just be patched — skills are
computed *from* the finished stat values (`src/engine/calculator.ts:84-88`), so a stat reading a
skill is a structural cycle across the pipeline.

## Suggested direction

Either remove `skills` from the `stat` row of `NAMESPACE_SCOPES` so the guard and preview refuse
what the calculator cannot honor (simplest, and consistent with the errors-as-values discipline),
or deliberately interleave the stat/skill passes if stat-reads-skill is a wanted feature. The
former is a one-line scope change plus a preview test; the latter is a design decision that needs
a requirement first.

## Related

- [CR-01](CR-01-circular-formula-detection-dead-in-production.md) — same theme: the validation
  layer promising things the calculation layer doesn't deliver.
