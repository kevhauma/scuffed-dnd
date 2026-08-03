# TICKET-SKL-03 — Skills panel, sheet grid, and skill validation

- **Area:** Skills configuration
- **Type:** Feature
- **Traceability:** Concept [02 · Skill](../../excel%20export%20summary/concepts/02-skill.md) (editor, validation, display)

## User story

As a User, I want to edit a skill's stat weights as rows, and as a Player I want my sheet to show
each skill's level and bonus with its breakdown, so the skill system is visible and tunable.

## Description

The UI and validation for TICKET-SKL-02's entity: config panel, sheet grid, and the concept
page's three validation rules.

## Current situation (as-is)

- Post-SKL-02 the entity and derivation exist; the speciality panel and the sheet's
  `SpecialitySkillsSection` are mechanically adapted but still formula-string-shaped, and none of
  the concept page's validation rules are implemented.

## Desired result (to-be)

- The Skills panel edits `statWeights` as add/remove/change rows against configured stats
  (domain shape, replacing the speciality panel's formula field).
- The sheet's skills grid shows **level and bonus** per skill with a labelled breakdown (stat
  contributions by weight, invested) via `SkillBreakdownRow`.
- Validation per the concept page: zero-weights-and-no-investment warns (always level 0);
  weight sum far above ~0.5 surfaces as *information*; near-duplicate skill names warn
  (`skinning`/`Skinning`) — all through the standard validation report with distinct severities.

## Acceptance criteria

- [ ] Weight-row editing works end-to-end through the manager hook and store actions (component tests for add/remove/change).
- [ ] Sheet grid renders level + bonus + breakdown from the calculator; no component re-derives arithmetic.
- [ ] The three validation rules appear with their severities (warning / information / warning) in the validation report (tests each).
- [ ] Components compose `ui/` primitives, own their layout, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: edit a weight, watch level and bonus move on the sheet. (Ask the User first per CLAUDE.md.)

## Notes

- The 57 seed skills come with the sheet-import milestone; the fresh-config seed stays minimal.
