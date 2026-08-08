# TICKET-CRV-03 — Curves panel and seed curves

- **Area:** Curves configuration
- **Type:** Feature
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md); Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md) (point-buy values)

## User story

As a User, I want to edit curves as a grid — override cells visibly distinct — and get the
sheet's point-buy and XP curves out of the box, so progressions are tables I read and tweak.

## Description

The UI for CRV-01/CRV-02 plus the two seed curves the rest of the milestone consumes.

## Current situation (as-is)

- CRV-01/02 land the entity, lookup, and generator machinery with no editor and no seeds; no
  `/config/curves` route exists.

## Desired result (to-be)

- A Curves panel at `/config/curves` (domain shape + dashboard card): grid editing with
  `Input`-composed cells, per-curve settings (interpolation, out-of-range, direction) inline,
  overridden cells visually distinct, a regenerate action showing CRV-02's report.
- Seed `point_buy`: key `points`, columns `non` / `sub` / `main`; `main` generated as
  `0.75 * (key + 1)` (confirmed derivation), `non`/`sub` hand rows from the concept page
  including the 15-point row `5 / 7 / 12`.
- Seed `xp_thresholds`: key `level`, column `xp_required`, reverse, step, extrapolate, minimal
  rows (level 1 = 0) — the real thresholds are open question #8; seed the shape, not invented
  numbers.

## Implementation notes (2026-08-08)

1. **A curve column became a guarded-delete target.** Criterion 7 made a column a renamable,
   id-resolved entity, and that changes what removing one means: a formula reading
   `curve.point_buy.main(x)` now points at something with an identity. So `deleteCurveColumn`
   goes through `guardedDelete` with a new `curve-column` `ReferenceTargetKind`, rather than
   being the one delete in the app that isn't checked. Not in the to-be — it followed from
   criterion 7 and is recorded here rather than smuggled in.
2. **Giving a hand-entered column a generator flags its existing cells** (`flagColumnAsOverridden`
   in `engine/curveGenerator.ts`). Without it, the first Regenerate after adding a generator
   overwrites every number somebody typed — the exact silent rebalance CRV-02 exists to prevent,
   newly reachable because this ticket is what makes adding a generator possible. Concept 06 says
   the same about import: bring the column in flagged, then decide.
3. **"Add row" appends one key past the last** rather than prompting for a key. That covers
   Concept 06's "extend point-buy to 40 points" scenario; authoring a row at an arbitrary key
   (0.5, or before the first row) is not reachable from the UI and is left for a later ticket.

## Acceptance criteria

- [x] Grid CRUD (rows, cells, settings) persists through store actions; component tests cover editing and the override highlight. (`configStore.ts` gains `addCurveColumn`/`deleteCurveColumn`/`addCurveRow`/`deleteCurveRow`/`setCurveCell`/`clearCurveOverride`, all routed through `engine/curveTable.ts` + `engine/curveGenerator.ts` via the shared `editCurve` helper; `CurvesConfigPanel.test.tsx` — "should persist a typed cell and mark a generated one as an override", "should show an override as visibly distinct from a generated cell", "should add a row past the last key and delete one by key", "should persist a settings change through the store")
- [x] Regenerate in the panel shows the kept-overrides report; guarded delete via REF-02. The report's `errors` carry `{ key, column, error }` (TICKET-CRV-02), so a failing cell is highlighted from the address rather than by parsing a message. (`CurveCard.tsx` renders `written`/`kept`/`errors`; `CurveGrid.tsx` matches `cellErrors` on `{ key, column }` and renders an `ErrorChip`; `CurvesConfigPanel.test.tsx` — "should keep an override through a regeneration and report that it did", "should highlight the failing cell from the report's address, not from a message", "should refuse to delete a curve a formula calls, naming what points at it", "should refuse to delete a column a formula reads, naming what points at it")
- [x] **Adding or removing a column splices `rows[].values` and `rows[].overridden` together.** Both are positional against `columns` and `updateCurve` replaces wholesale, so a caller that rewrites `columns` alone shifts every override flag onto the wrong cell. CRV-02 states the invariant and nothing yet enforces it; this is the ticket that makes column editing reachable. (`engine/curveTable.ts`; `curveTable.test.ts` — "should carry each surviving flag with its own cell" plus the fast-check property "should keep values, flags and columns the same length under any edit sequence"; `CurvesConfigPanel.test.tsx` — "should carry a surviving override onto its own cell when a column is removed". The store exposes no way to rewrite `columns` positionally except through these helpers.)
- [x] The `point_buy` seed reproduces `main = 0.75 × (points + 1)` for every generated row and the 15-point row exactly (also a DX-04 fixture later). (`createSeedCurves()` in `configStore.ts` ships the column as the generator string and fills the cells by running it through `regenerateCurve`, so there is one source of truth; `configStore.test.ts` — "reproduces main = 0.75 × (points + 1) on every point_buy row", "carries the concept page's 15-point row exactly" (`5 / 7 / 12`), "keeps the sheet's 9-point sub-type anomaly rather than rounding it away")
- [x] Panel follows the domain shape, `ui/` primitives, theme tokens only; export/import round-trips both seeds. (`components/config/curves/` = `CurvesConfigPanel` + `CurveCard` + `CurveFormDialog`/`CurveColumnDialog` + `useCurveManager`, plus `CurveGrid`; every control is a `ui/` primitive, colours are `parchment-*`/`stone-*`/`ink-*`/`amber`; the `conventions-reviewer` subagent confirmed no raw elements, no hex, no stock palette. `configStore.test.ts` — "exports and re-imports both seeds unchanged")
- [x] The form enforces, for User input, the two rules TICKET-CRV-01 could only enforce at the import boundary: a curve's `name` and each column's `name` are lowercase identifiers, and curve names are unique. A duplicate splits identity (`curve.[id]`) from behaviour (the other curve's table) — the same argument as [TICKET-CST-02](./TICKET-CST-02-constants-panel.md)'s, which closed the equivalent gap for constants. (`useCurveManager.ts` `handleSaveCurve` and `columnFormError`; column uniqueness is scoped to the owning curve, since `main` in two curves is two columns. `CurvesConfigPanel.test.tsx` — "should refuse a curve name that is not a lowercase identifier or is taken", "should refuse a column name that is not a lowercase identifier", "should refuse a second column with a name this curve already has". The generator gets the same `validateFormulaChange` gate every other formula save gets — "should refuse a generator that names something out of scope".)
- [x] Renaming a **column** re-spells every formula naming it. CRV-01 made curve *names* rename-safe but not column names — a column is a property, and properties have never been id-resolved (`skills.STL.level` is the same shape). This is the ticket that makes renaming a column reachable, so it is the ticket that has to close it: either extend `references.ts` with a curve-scoped column space, or refuse the rename and say why. (**Took the first branch** — refusing would contradict the milestone's "everything is configurable" decision. `references.ts` gains a `curveColumn` space keyed `curveId + columnName` for the stored direction and by column id for the display direction; `parser.ts` accepts a `REF_ID` in the property position, so the persisted form is `curve.[curveId].[columnId](x)`. Tests: `references.test.ts` — "re-spells a curve column when the column is renamed", "keeps two curves' identically named columns apart", "leaves a column spelled by name in an older stored formula alone"; `configStore.test.ts` — "re-spells every formula reading a column when the column is renamed"; `CurvesConfigPanel.test.tsx` — "should re-spell a formula when a column is renamed")
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`verifier`: 68 files / 1091 tests passing, 0 failed, 0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run lint` and `npx biome check .` clean. `conventions-reviewer`: 8 findings, 7 fixed in this change — generator validation, guarded column delete, the generator-on-a-hand-entered-column hazard, the hand-rolled seed arithmetic, both knowledge skills, the backward-compatibility test, the layering of the seed round-trip test, and the two doc nits; nothing left open. `fallow audit --base HEAD`: no dead code, no boundary or circular findings introduced; the two complexity findings it raised on new code were reduced by extracting `columnFormError` and the shared `UsageList` — see the note below for what is deliberately left.)
- [ ] Verified live in the browser: edit a cell, regenerate, watch the override survive visibly. (Ask the User first per CLAUDE.md.) — **left open: the User skipped the live check for this run.**

## Notes

- Biggest UI piece of the milestone; compose from `ui/` primitives rather than minting a
  data-grid primitive — material tiers will be the second caller later, and that's when a shared
  grid earns extraction.
- Left deliberately, both pre-existing patterns this panel joins rather than starts: the
  eight-panel header/tip block that `fallow dupes` reports across every configuration panel, and
  the "Display Name + Formula Name" field pair shared by `ConstantFormDialog` and
  `CurveFormDialog`. Extracting either touches domains this ticket has no business editing.
  `useCurveManager` stays at cognitive 21 (21 hooks) because the domain genuinely has five
  editable things; splitting it would be a hook per dialog, which is a refactor, not this ticket.
