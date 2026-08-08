# TICKET-CRV-02 — Curve generators with preserved overrides

- **Area:** Curves configuration
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md); Concept [00 · Field model §1.1](../../excel%20export%20summary/concepts/00-field-model.md) (generated + overridden)

## User story

As a User, I want curve columns filled by a formula but with my hand-tuned cells kept and
highlighted, so regenerating a progression never silently rebalances the game.

## Description

The spec's central editing idea — generate, overlay overrides, show both — implemented on
TICKET-CRV-01's entity. This is the machinery the sheet's four confirmed hand-tuned anomalies
need, and the pattern material tier generators reuse in a later milestone.

## Current situation (as-is)

- CRV-01's rows are hand-entered values only; no generator, no override flag, no regeneration —
  the state the whole app is in today for every tabular value.

## Desired result (to-be)

- A column may carry a **generator formula** evaluated in the row context (`key`, `const.*` —
  a FORM-04 scoping-table row).
- **Regenerate** refills computed cells, **preserves every cell flagged `overridden`**, and
  returns a report (cells written, overrides kept); extending the key range generates the new
  rows.
- Hand-editing a generated cell flags it `overridden`; clearing the flag reverts it to the
  generated value.

## Implementation notes (2026-08-07)

1. **`key` is a bare variable, and that works by accident of the parser's oldest rule.** A
   generator is written `const.point_multiplier * (key + 1)`; the parser normalises bare
   identifiers to uppercase, so it becomes `KEY`, which is what the row context binds. The scoping
   table names it as a *context code* — a new `CONTEXT_CODES` row beside `LEGACY_CODE_SCOPES`,
   because it is a name the attachment point supplies rather than one drawn from the ruleset.
2. **A generator sees `key` and `const.*`, and nothing else.** No skill codes — a generator fills a
   table, not a character — and deliberately no `curve.*`: a table generated from another table is
   a cycle waiting to happen, `validateFormulaChange`'s detector does not reach curve columns, and
   no seed needs it.
3. **A failed generator keeps the cell and reports it**, rather than refusing the whole
   regeneration. Refusing would leave the User with neither the old table nor the new one; the
   report names every failure, cell by cell.
4. **The overridden flag is positional, like `values`**, so adding or removing a column must
   splice both arrays the same way — one addressing rule per row. An all-`false` array is
   normalised back to absent, so a curve with no overrides round-trips without growing one.
   Nothing here *enforces* the splice, because nothing here edits columns: `updateCurve` replaces
   wholesale, and column editing arrives with CRV-03, whose acceptance criteria now carry the
   obligation.
5. **The concept page's own XP generator is not yet writable.**
   `round(const.xp_base * level ^ const.xp_exponent)` needs exponentiation, and the formula
   engine has neither a `^` operator nor a `pow` function — FORM-02 defined the library as closed.
   Nothing in this ticket or CRV-03 needs it (`point_buy`'s `main` column is
   `0.75 × (points + 1)`, and CRV-03 seeds the XP curve's *shape* rather than invented numbers),
   so it is flagged rather than fixed: adding an operator is a formula-engine change with its own
   precedence and validation questions. Raised as
   [TICKET-FORM-07](./TICKET-FORM-07-exponentiation.md), which carries the `^`-versus-`pow()`
   decision.
6. **A generator is a formula like any other, and had to be wired into both subsystems that own
   that idea** — caught by the conventions review, not by me. `engine/dependencies.ts` now walks
   curve generators, so a constant named only from one blocks its own delete; and
   `engine/formula/references.ts` id-resolves them, so renaming that constant re-spells the
   generator instead of freezing the column on the next regeneration. Both were silent failures
   with a working test suite.
7. **The regeneration report addresses failing cells rather than describing them.**
   `errors: { key, column, error }` instead of a formatted string, so CRV-03 highlights the cell
   from the address and renders the message with `describeFormulaError` — the FORM-05 contract,
   not prose that has to be parsed back apart.

## Acceptance criteria

- [x] Generator evaluation per row is tested, including `const.*` references. (`curveGenerator.test.ts` — "should fill a generated column from its formula, row by row" (`const.point_multiplier * (key + 1)` over keys 0/1/2 → 0.75/1.5/2.25, the concept page's confirmed `main_type` derivation), "should resolve const.* in a generator, so retuning one moves the whole column" (multiplier 0.75 → 1 moves every row), "should not touch a column with no generator". Scope: `scoping.test.ts` "gives a curve generator the row key and the constants, and nothing else" — `KEY` in, skill codes out, `const` present, `curve` and `stats` absent.)
- [x] Regeneration preserves overrides — including the "generator changed under an override" case — and the report matches what happened. (`curveGenerator.test.ts` "should keep every overridden cell and count it" — the point-buy `4.642857` anomaly kept while its neighbours regenerate, report `{written: 2, kept: 1, errors: []}` — and "should keep an override even when the generator changed under it", where the column's formula is edited from `0.75 × (key+1)` to `0.5 × (key+1)` under a flagged cell: the two unflagged rows move, the flagged one holds at 99. Report shape is asserted whole (`toEqual`) rather than field by field, so a miscount is a failure. Failures: "should report a generator that cannot produce a number, keeping what was there" — three named errors, `written: 0`, the old value intact.)
- [x] Flag lifecycle tested: edit flags, clear reverts, regenerate respects. (`curveGenerator.test.ts` — **edit flags**: "should flag a hand edit to a generated cell as an override", "should not flag a column that has no generator to deviate from"; **clear reverts**: "should put the generated value back and drop the flag", "should leave a cleared cell free to move with the generator again", plus "should keep the value and the flag when the generator cannot produce a number" — dropping the flag there would silently adopt a number nobody chose; **regenerate respects**: "should survive a regeneration once flagged". Through the store: `configStore.test.ts` "regenerates a curve through the store, persisting the result" — one row written, one kept, one `saveConfiguration`.)
- [x] Row-shape change is additive: CRV-01 configs without flags still load and validate. (Both fields are optional and absent means the pre-CRV-02 state: no generator = hand-entered column, no `overridden` = nothing overridden. `importExport.test.ts` — the CRV-01 round-trip tests still pass unchanged with neither field present, "round-trips a generated column and its override flags" covers the new shape, and "rejects a non-string generator or a non-boolean override flag" covers the boundary. `curveGenerator.test.ts` "should leave a curve with no generators exactly as it was" (`rows` identical, report all zeroes) and "should leave no overridden array behind when nothing is overridden".)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (**1013 passing, 0 failing, 0 skipped** (from 981 — 19 in the new `curveGenerator.test.ts`, the rest across the scoping, ruleset-validator, reference-walker, store and import/export suites), `npx tsc --noEmit` at the documented 4-error baseline, `yarn run check` clean over 244 files. fallow `audit --base HEAD`: **0 introduced dead code, 0 introduced duplication, 0 introduced complexity**. conventions-reviewer confirmed layering, engine purity, store-owned persistence, derived-vs-stored and the `Validates:` headers, and found nine things — **all addressed**: two high-severity bugs are implementation note 6; the sparse-array bug (a row shorter than the column list left holes in a `number[]`, which a lookup reads as `NaN`) is fixed in `withCell` and tested with a hand-entered column *preceding* a generated one; the report is now structured (note 7); a stale flag on a column whose generator was removed is now cleared, since a flag with no pattern to deviate from would silently refuse to fill the cell if a generator came back; an `overridden` array longer than the column list is now an import error rather than silently truncated; `CONTEXT_CODES` was made total like its sibling tables; the store's import is aliased so the action does not read as a recursive call; and the positional-splice obligation moved to CRV-03's criteria.)

## Notes

- Pure entity/engine work — the editor visuals for the flag land with TICKET-CRV-03.
- The point-buy sub-column's `4.642857…` anomaly (open question #3) is exactly what the flag is
  for; either answer is a data edit once this exists.
