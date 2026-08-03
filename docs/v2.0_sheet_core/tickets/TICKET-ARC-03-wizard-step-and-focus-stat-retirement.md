# TICKET-ARC-03 — Wizard archetype step; retire the focus stat

- **Area:** Archetypes configuration (play surface + removal)
- **Type:** Feature + Refactor
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md); v2.0 overview decision (focus stat → retired)

## User story

As a Player, I want to pick exactly one archetype during creation and see what my points will buy
before I spend them — with the old focus-stat mechanic gone rather than lingering beside it.

## Description

The last piece of the character-build loop: the wizard step consuming ARC-01/ARC-02, and the
removal of the focus stat, which the archetype replaces.

## Current situation (as-is)

- The wizard's `FocusStatStep` picks `focusStatCode`; `focusStatBonusLevel` applies as a flat
  adder in the calculators; [`FocusStatConfig`](../../../src/components/config/focus/) lives at
  `/config/focus`. All of it survived STAT-01–RES-03 untouched, waiting for this replacement.

## Desired result (to-be)

- `Character.archetypeId` — exactly one, required; the wizard step replaces `FocusStatStep`
  (order: identity → races → archetype → stat allocation → skills → review), and the allocation
  step re-renders per-stat gains when the archetype changes (state in `useCharacterCreation`).
- **Focus stat fully removed:** `focusStatCode`, `focusStatBonusLevel`, `FocusStatConfig`, the
  `/config/focus` route and nav entry, and both calculators' focus terms — nothing left to
  maintain beside the archetype.
- Export/import and shape validation cover `archetypeId` and the archetype entity; a v2 file
  carrying focus-stat fields is rejected as unknown (IO-03 strictness).

## Acceptance criteria

- [ ] Wizard requires one archetype; gains preview updates on archetype change (component tests).
- [ ] `focusStat` yields zero hits in `src/` (grep criterion); `/config/focus` is gone from routes and nav; `routeTree.gen.ts` regenerated, never hand-edited.
- [ ] No flat specialisation bonus is applied anywhere (calculator regression test).
- [ ] Shape validation round-trips `archetypeId`; guarded delete: an archetype on a character refuses via REF-02.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: create characters with two different archetypes from the same spend and compare sheets. (Ask the User first per CLAUDE.md.)

## Notes

- This closes the overview's triad-collapse row "focus stat → retired". If the User ever wants a
  flat-bonus mechanic back, it returns as an archetype `starting_bonus` field — additive, not a
  revival of the old fields.
