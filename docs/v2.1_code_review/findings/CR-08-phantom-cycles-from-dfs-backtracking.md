# CR-08 — `detectCircularDependencies` corrupts its recursion stack and reports phantom cycles

**Severity:** Medium · **Area:** engine (formula) · **Type:** correctness bug (latent behind CR-01)
**Status:** Confirmed by executable repro

## Summary

When the DFS finds a cycle it returns early without executing its backtracking step, leaving the
current node in `recursionStack` and `currentPath` permanently. Later traversals then "find"
cycles along edges that do not exist.

## Evidence

- `src/engine/formula/validator.ts:343` — on cycle detection, `dfs` returns `true` without
  running the backtracking at lines 356-357.
- **Repro (executed):** for edges `A→{B,C}, B→B, C→B` (the only real cycle is `B→B`) it reports
  `[["B","B"],["B","C","B"]]` — the second chain contains an edge `B→C` that does not exist.

## Impact

Currently invisible in production because [CR-01](CR-01-circular-formula-detection-dead-in-production.md)
prevents the detector from firing at all with UUID ids (it is live in any id-aligned config, which
is what the tests use). The moment CR-01 is fixed, users would see *wrong cycle reports* —
refusals citing formulas that aren't actually in a cycle. Fix both together.

## Suggested direction

Make the backtracking unconditional (`finally`-style pop of `recursionStack`/`currentPath`), or
restructure to the standard three-color DFS. Add the `A→{B,C}, B→B, C→B` graph as a regression
test asserting exactly one reported cycle.
