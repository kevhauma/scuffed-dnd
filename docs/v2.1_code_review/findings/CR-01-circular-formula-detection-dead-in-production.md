# CR-01 — Circular-formula detection never fires in production

**Severity:** High · **Area:** engine (formula) · **Type:** correctness bug
**Status:** Confirmed by executable repro (real modules, not mocks)

## Summary

`detectCircularDependencies` keys its graph nodes by `stat.id` but its edges by *display
spellings*, so in any real configuration (where ids are `crypto.randomUUID()`) no edge is ever
followed and every formula cycle — including a direct self-reference — saves without complaint.
The save-time refusal required by Requirement 16.5 is dead code.

## Evidence

- Nodes: `src/engine/formula/validator.ts:305` (`detectCircularDependencies`) receives
  dependencies built by `toFormulaDependency(stat.id, …)` — keyed by **id**.
- Edges: `dependencyKeysOf` yields the **spellings** used in the formula text — uppercased
  abbreviations (`STR`) and name slugs (`stats.health` → `health`).
- The DFS only follows an edge when `formulaMap.has(varId)` (`src/engine/formula/validator.ts:332`).
  A spelling never equals a UUID, so the map lookup always misses.
- Real stat ids are UUIDs (`src/components/config/stats/useStatManager.ts:256`), and stored
  formulas are converted to display form on load (`src/services/storage.ts:148`).
- **Repro (executed):** with UUID ids, a mutual cycle (`Alpha: stats.beta + 1`,
  `Beta: stats.alpha + 1`) passes both `validateConfiguration` (zero errors) and
  `validateFormulaChange` (`isValid: true`). Even `stats.alpha * 2` **on Alpha itself** saves
  cleanly.
- The test suite passes only because every cycle fixture sets `id === abbreviation`;
  `src/engine/formula/formulaChange.test.ts:88-90` states this alignment explicitly. The comment
  at `src/engine/validator.ts:259-261` ("its member, which is the stat id … the graph is keyed
  by") is a stale pre-UUID assumption.

## Impact

A User can save a ruleset with formula cycles and gets no refusal and no report. The app does not
hang — `calculateStatValues`'s fixed-point pass degrades each cycle member to an error chip at
read time — but the error surfaces on the character sheet, far from the edit that caused it,
instead of at save time where Requirement 16.5 places it.

Consumers of the broken check: `src/engine/validator.ts:182-195` (full-config validation) and
`src/engine/formula/formulaChange.ts:107` (per-edit guard).

## Suggested direction

Resolve dependency spellings to stat ids namespace-aware (abbreviation → id, `stats.<slug>` → id)
inside `toFormulaDependency`, which therefore needs the config in hand. Add a non-aligned-id
fixture (UUID ids, display-form formulas) to the cycle tests so the key spaces can never silently
diverge again.

## Related

- [CR-08](CR-08-phantom-cycles-from-dfs-backtracking.md) — the same function mis-reports cycle
  *paths* once it does fire; fix together.
