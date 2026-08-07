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

## Acceptance criteria

- [ ] Grid CRUD (rows, cells, settings) persists through store actions; component tests cover editing and the override highlight.
- [ ] Regenerate in the panel shows the kept-overrides report; guarded delete via REF-02.
- [ ] The `point_buy` seed reproduces `main = 0.75 × (points + 1)` for every generated row and the 15-point row exactly (also a DX-04 fixture later).
- [ ] Panel follows the domain shape, `ui/` primitives, theme tokens only; export/import round-trips both seeds.
- [ ] The form enforces, for User input, the two rules TICKET-CRV-01 could only enforce at the import boundary: a curve's `name` and each column's `name` are lowercase identifiers, and curve names are unique. A duplicate splits identity (`curve.[id]`) from behaviour (the other curve's table) — the same argument as [TICKET-CST-02](./TICKET-CST-02-constants-panel.md)'s, which closed the equivalent gap for constants.
- [ ] Renaming a **column** re-spells every formula naming it. CRV-01 made curve *names* rename-safe but not column names — a column is a property, and properties have never been id-resolved (`skills.STL.level` is the same shape). This is the ticket that makes renaming a column reachable, so it is the ticket that has to close it: either extend `references.ts` with a curve-scoped column space, or refuse the rename and say why.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: edit a cell, regenerate, watch the override survive visibly. (Ask the User first per CLAUDE.md.)

## Notes

- Biggest UI piece of the milestone; compose from `ui/` primitives rather than minting a
  data-grid primitive — material tiers will be the second caller later, and that's when a shared
  grid earns extraction.
