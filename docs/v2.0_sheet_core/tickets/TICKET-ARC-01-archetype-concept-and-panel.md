# TICKET-ARC-01 — Archetype concept and panel

- **Area:** Archetypes configuration (new area)
- **Type:** Feature
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md)

## User story

As a User, I want to define archetypes — each tagging every stat as main, sub, or non — so my
ruleset can say what a Strong or Funny character is good at growing.

## Description

The entity and its editor. The point-buy routing that makes affinity *do* something is
TICKET-ARC-02; the wizard step and focus-stat retirement are TICKET-ARC-03.

## Current situation (as-is)

- No archetype/affinity concept anywhere in `src/`. The only specialisation mechanic is the
  focus stat (`focusStatCode` + global `focusStatBonusLevel`) — a flat adder the spec doesn't
  recognize, retired in ARC-03.

## Desired result (to-be)

- `Archetype` entity `{ id, name, description, statAffinity: Record<statId, 'main' | 'sub' |
  'non'> }` with CRUD store actions and export/import shape coverage.
- An Archetypes panel at `/config/archetypes` (domain shape + dashboard card): per-stat affinity
  picker per archetype; the editor grows a row per configured stat.
- Validation: a stat absent from an archetype's affinity defaults to `non` with a warning (spec
  rule); the `point_buy` curve must have a column per affinity value used — a missing column is a
  named config-level validation error.

## Acceptance criteria

- [ ] CRUD round-trips persistence and export/import via store actions.
- [ ] The panel edits affinities per stat and grows a row when a stat is added (component test); default-to-non warning surfaces in the validation report.
- [ ] Missing point-buy column produces the named validation error (test).
- [ ] Guarded delete via REF-02 (an archetype referenced by a character refuses with the list).
- [ ] Components compose `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: create an archetype, tag affinities. (Ask the User first per CLAUDE.md.)

## Notes

- Seed archetypes (Strong/Sneaky/Smart/Wise/Tanky/Funny) come with the sheet import; a fresh
  config seeds none.
- `starting_bonus`, `skill_affinity`, `unlock_condition` deferred (the last needs boolean
  formulas).
