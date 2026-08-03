# TICKET-STAT-03 — Wizard and sheet on unified stats

- **Area:** Stats configuration (play surfaces)
- **Type:** Feature
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md) (where a value comes from; resource gating)

## User story

As a Player, I want to allocate points into stats when creating a character and see them on my
sheet with their breakdown — and only resource stats offering current-value controls — so play
mode speaks the unified model.

## Description

The play-mode half of the STAT-01 rework: the creation wizard's allocation step and the sheet's
stat sections, replacing STAT-01's mechanical patches with the intended UX.

## Current situation (as-is)

- Post-STAT-01, [`SkillAllocationStep`](../../../src/components/play/creation/) and the sheet's
  `MainSkillsSection`/`StatsSection` compile against the new model but still present the old
  main-skills-vs-stats split, and [`StatEditor`](../../../src/components/play/sheet/StatEditor.tsx)
  renders for every stat rather than only resources.

## Desired result (to-be)

- The wizard's allocation step allocates `investedStatPoints` across invested stats
  (validator-driven, per the established `useCharacterCreation` pattern); derived stats preview
  read-only.
- The sheet gets one stats grid in `order`: value + labelled breakdown (base / invested /
  equipment via `SkillBreakdownRow`); `StatEditor`'s current-value controls render **only** for
  `isResource` stats; derived stats show their computed value with FORM-06 chips on error.
- The temporary abbreviation bridge for legacy speciality/combat formulas keeps those sections
  working, with a test that marks it as scaffolding to be removed by SKL-02/ROLL-06.

## Acceptance criteria

- [ ] Wizard flow creates a valid v2 character end-to-end; allocation consumes the engine validator, sums nothing itself.
- [ ] Sheet grid renders by order with breakdowns from the calculator; no component re-derives arithmetic.
- [ ] Resource gating: exactly the `isResource` stats have editable current values (component test both ways).
- [ ] The bridge test exists and names the tickets that retire it.
- [ ] Components compose `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: create a character, check the grid, confirm only resources are editable. (Ask the User first per CLAUDE.md.)

## Notes

- Wizard step order changes again in ARC-03 (archetype step) — keep step composition in
  `useCharacterCreation` so that's cheap.
