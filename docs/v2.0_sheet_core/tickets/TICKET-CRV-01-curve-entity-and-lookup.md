# TICKET-CRV-01 — Curve entity and lookup engine

- **Area:** Curves configuration (new area)
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md)

## User story

As a User, I want named lookup tables that formulas call as `curve.name(x)`, so progressions are
data I tune rather than arithmetic scattered through the rules.

## Description

The entity and the lookup semantics. Generators are TICKET-CRV-02, the grid editor and seeds
TICKET-CRV-03. RES-01 (xp_thresholds, reverse) and ARC-02 (point_buy, multi-column) consume this.

## Current situation (as-is)

- No lookup-table entity in [`config.ts`](../../../src/types/config.ts); the nearest analogue
  (`Material.levels`) is a hand-entered array with no lookup callable from a formula.
- FORM-03 parses `curve.name(x)` with nothing behind it.

## Desired result (to-be)

- `Curve` entity: `{ id, name (identifier), displayName, description, keyName, columns:
  [{ id, name }], rows: [{ key, values[] }], interpolation: 'step' | 'linear', outOfRange:
  'clamp' | 'extrapolate' | 'error', lookupDirection: 'forward' | 'reverse' }`, CRUD store
  actions, export/import shape.
- Engine lookup with the spec's semantics: `step` holds the last row ≤ x; `linear` interpolates;
  `outOfRange` applies beyond the ends with `error` producing a FORM-05 error value; `reverse`
  answers "the highest key whose value ≤ x".
- `curve.name(x)` (single-column) and `curve.name(x, column)` evaluate in formulas; unknown
  curve/column are named validation errors; duplicate or unsorted keys are validation errors.

## Implementation notes (2026-08-07)

1. **Divergence — the column form is `curve.name.column(x)`, not `curve.name(x, column)`.**
   The to-be's second form is not expressible in this grammar: a call argument is an *expression*,
   and a bare identifier in an expression is already a legacy variable reference (uppercased by
   the parser), so `curve.point_buy(3, main_type)` reads `main_type` as a skill code. The
   alternatives were a positional column *index*, which throws away the name the ticket wants
   errors to quote, or a parser rule that guesses which arguments are column names, which is
   ambiguous by construction. A third segment is neither: it reuses the property slot
   `skills.healing.level` already has, where a property likewise selects *which* value. The ticket
   title's two call forms — one column and many — are both delivered; only the spelling of the
   second changed. One alternative not taken: spec §5.3 lists `lookup(table, key, column)` in the
   function library, which would need no grammar change — but it puts curve access behind a
   *second* syntax alongside `curve.name(x)`, and `table`/`column` as bare identifiers hit exactly
   the ambiguity above. Worth revisiting if the function library ever gains non-numeric arguments
   for other reasons.
2. **Every mode is one lookup.** The table is reduced to `(input, output)` pairs — forward reads
   `key → value`, reverse reads `value → key` — and one interpolation applies to both. The
   concept page's "highest key whose value is ≤ x" therefore needs no rule of its own; it *is*
   `step` applied to the inverted table, which is what that page says it should be.
3. **Extrapolation respects the interpolation mode**, which the first draft got wrong and a test
   caught. Extending an XP table linearly answers "level 4.4"; a `step` curve extends the **grid**
   instead — the end pair's spacing keeps repeating — so you stay level 4 until you cross the next
   threshold, which is the entire reason the table steps.
4. **Curve names are rename-safe; column names are not yet.** `references.ts` gained a `curve`
   space, so a persisted formula holds `curve.[id](x)` and renaming a curve re-spells every call.
   A column is a property, and properties have never been id-resolved (`skills.STL.level` is the
   same) — so renaming a *column* does break formulas naming it. TICKET-CRV-03 builds the editor
   where a column can be renamed, and is where that has to be closed.
5. **`namespacesFor(config, owner)` is new** (`engine/formula/namespaces.ts`). Three calculators
   and `StatCard` each built `{ const: … }` by hand; adding a second resolver would have made four
   places to keep in step with `scoping.ts`'s table of what is *allowed*. Now the same table
   decides both, so a namespace in scope resolves and one out of scope does not — which is why a
   speciality skill's formula still cannot reach `curve.*`.
6. **A reverse curve's value column must not decrease**, and `engine/validator.ts` reports it if it
   does. Concept 06 phrases reverse lookup as "the highest key whose value is ≤ the input"; what
   the sorted-inversion actually answers is "the key of the greatest value ≤ the input". Those are
   the same sentence for a threshold table and different ones for a column that doubles back —
   where the question has two equally correct answers and no implementation can be right. Naming
   it as an error is what keeps the User from ever meeting the arbitrary choice; the module header
   states the precise rule rather than quoting the concept page.
7. **A missing or non-finite cell makes the table unreadable**, rather than yielding `NaN`. `NaN`
   is a `number` as far as `FormulaResult` is concerned, so it would pass `isFormulaError`,
   `asNumber` and arithmetic and land on a character sheet — the exact silent-wrong-number failure
   Concept 00 §7 exists to prevent. It is reachable: adding a column without backfilling rows is
   what CRV-03's grid editor will do.
8. **Unknown column is caught at evaluation, not at save.** Scope members are curve *names*;
   checking the column would mean teaching `collectScopeErrors` about one namespace's shape, and
   the branch-free table is the point of that module. The error is named either way —
   `Unknown member: curve.point_buy.nope` — and reaches the User through the same error chip as
   any other.

## Acceptance criteria

- [x] Each lookup mode has its own test: step, linear, clamp, extrapolate, error-out-of-range, forward, reverse — including boundary keys (exactly on a row). (`curves.test.ts`, one describe per mode: **step** — "should hold the last row at or below the key", "should read a boundary key as that row, not the one before it", "should hold the same value across a whole band"; **linear** — "should interpolate between the two rows either side", "should return the row exactly when the key lands on one"; **clamp** — "should clamp to the nearest end"; **extrapolate** — "should extrapolate a step curve onto the continued grid, not along a line", "should extrapolate a linear curve along the line through the end rows", "should hold its one value when a single-row curve is extrapolated"; **error** — "should refuse with an error value naming the range" plus "should not treat the ends themselves as out of range"; **forward** is the default of every case above; **reverse** — "should answer with the highest key whose value is at or below the input", "should promote exactly on a threshold, not one short of it", "should keep producing whole levels past the last row when extrapolating", "should refuse below the first value when configured to", "should read the value column in order even when the rows are not". Fixtures are the concept page's own point-buy and XP tables.)
- [x] Both call forms evaluate from formulas; unknown curve/column errors are named; `error` out-of-range propagates as an error value, not a throw. (Form is `curve.name.column(x)` per implementation note 1. `curves.test.ts` "curve calls in formulas" — "should evaluate the single-column call form" (`curve.growth(3)` → 10), "should evaluate the column-selecting call form" (`curve.point_buy.main_type(3)` → 3), "should take an expression as its input, not just a literal", "should compose with arithmetic and the function library". Named errors: "should name an unknown curve" → `Unknown member: curve.nope`, "should name an unknown column" → `Unknown member: curve.point_buy.nope`. Out of range: "should propagate an out-of-range refusal as a value rather than throwing" asserts `not.toThrow()` and an `out-of-range` kind surviving `+ 1`. Parsing: `parser.test.ts` "should parse a namespaced call that selects a column", "should still parse three segments without parentheses as a property access", "should parse a column-selecting call on a persisted id reference".)
- [x] Key uniqueness/ordering validation reports through the standard validation surface. (`engine/validator.ts`'s `validateConfiguration` — the same report the config dashboard renders. `validator.test.ts` "curve tables (TICKET-CRV-01)": "reports a duplicate key, naming the key column", "reports rows that are not sorted by key", "reports a row with the wrong number of values", "reports a curve with no value columns", each carrying `entityId`; plus Concept 06's gap rule as a **warning** — "warns about a gap that silently collapses a wide band onto one value" and "does not warn about gaps when the curve interpolates". Import-time shape checking is separate and in `importExport.ts`: `importExport.test.ts` "rejects a curve with a bad identifier, an unknown mode, or a mis-sized row" and "rejects two curves claiming the same name".)
- [x] CRUD round-trips persistence and export/import via store actions. (`configStore.test.ts` "Curves (TICKET-CRV-01)" — "adds, updates and deletes through the store, persisting each time" (three `saveConfiguration` calls, nothing outside the store touching storage), "refuses to delete a curve a formula calls, and says which" (REF-02's `guardedDelete`, new `curve` target kind in `engine/dependencies.ts`), "re-spells every formula calling a curve when its identifier is renamed", "keeps the column segment when it re-spells a call that names one". Export/import: `importExport.test.ts` "survives export then import, call and all" — the exported JSON holds `curve.[id-xp](10)` and re-importing returns the configuration unchanged — and "accepts a file that predates the entity, leaving it absent".)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (**981 passing, 0 failing, 0 skipped** (from 917 — +38 `curves.test.ts`, the rest spread across the parser, evaluator, errors, scoping, store, import/export and ruleset-validator suites), `npx tsc --noEmit` at the documented 4-error baseline, `yarn run check` clean over 242 files. The verifier also caught that `TEST_STATUS.md` and `CLAUDE.md` still cited 898 — both refreshed here, since the "any failure is a regression" bar depends on that number. fallow `audit --base HEAD`: **0 introduced dead code, 0 introduced duplication**; of three introduced complexity findings, `lookupCurve` (cyc 15) was split — the out-of-range modes moved into `outsideTable` — and the remaining two, `buildReferenceIndex` and `curveShapeErrors`, are flat lists of independent checks where splitting would cost more than it buys. conventions-reviewer confirmed layering, store-owned persistence, derived-vs-stored, formula-engine-only math and the `Validates:` headers, and found five things, **all addressed here**: (1) a real bug — a missing cell yielded `NaN`, which is a `number` and would have reached a sheet; `lookupPairs` now returns an error value (implementation note 7); (2) reverse lookup did not implement the sentence its header quoted — resolved by validating the value column as non-decreasing and stating the precise rule (note 6); (3) `keyName` and `description` were unchecked at the import boundary, and column names were not held to the identifier rule despite being formula segments — both closed, with tests; (4) curve-name uniqueness has no User-input guard, which belongs to CRV-03 and is now an acceptance criterion there, alongside the column-rename gap; (5) the out-of-range message quoted `keyName` even for a reverse curve, where the numbers are values — now named for the axis actually searched. It also noted `curves.ts` should cite spec §7, where the entity is defined — added.)

## Notes

- Rows here are plain values; the `overridden` flag arrives with CRV-02's generators — design the
  row type so adding it is additive.
- The `challenge_rating` seed curve belongs to the creature milestone.
