# TICKET-STAT-02 — Unified stats configuration panel

- **Area:** Stats configuration
- **Type:** Feature
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (fields, editing scenarios)

## User story

As a User, I want one Stats section where I define every axis — name, abbreviation, order, flags,
optional formula — so "add a Sanity stat" is one record in one place.

## Description

The real editor for STAT-01's unified model, replacing the split main-skills/stats panels that
STAT-01 only mechanically patched.

## Current situation (as-is)

- Post-STAT-01, the old `MainSkillsPanel` (in `/config/skills`) and `StatsConfigPanel`
  (`/config/stats`) are mechanically adapted but still present the split model in two places with
  none of the new fields surfaced properly.

## Desired result (to-be)

- **One Stats panel at `/config/stats`** (domain shape): per-stat editing of name, abbreviation,
  description, `countsTowardTotal`, `isResource`, `min`/`max`, `rounding`, and the optional
  derived formula via the `FormulaEditor`; drag-reorder writes `order`.
- `/config/skills` drops its main-skills section (Skills remain until SKL-02 reworks them); the
  dashboard card index reflects the merge.
- Panel-level validation surfacing: duplicate abbreviation warning (REF-01 downgraded it from
  identity), derived-stat-with-investment prevented by construction, `isResource` on a derived
  stat allowed only with a formula-derived max (the concept page's warning).

## Acceptance criteria

- [ ] All unified fields editable end-to-end through `useStatManager` and store actions; reorder persists and drives display order.
- [ ] Route/dashboard reflect the merge; no main-skills editing surface remains (route test per the configRoutes pattern).
- [ ] The three validation surfacings above each have a component test.
- [ ] Components compose `ui/` primitives, own their layout, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: add a stat, flag it, reorder, see the order everywhere. (Ask the User first per CLAUDE.md.)

## Notes

- The "add a stat → every dependent editor grows a column, defaulted" scenario is asserted where
  those editors exist (races in RACE-01, archetypes in ARC-01) — this ticket only has to keep the
  stat list authoritative.
