# TICKET-ROLL-05 — Roll definitions and the rolls panel

- **Area:** Dice & rolls
- **Type:** Feature
- **Traceability:** Concept [08 · Roll definition](../../excel%20export%20summary/concepts/08-roll-definition.md)

## User story

As a User, I want named rolls — melee, ranged, evasion, endure — each an input expression plus a
ladder, so what a character rolls is configuration, not six hand-typed dice counts per skill.

## Description

The entity and its config editor. The sheet flow that replaces combat skills is TICKET-ROLL-06.

## Current situation (as-is)

- [`CombatSkill`](../../../src/types/config.ts) `{ code, name, description, dice, bonusFormula }`
  is the roll-shaped concept: a hand-typed pool plus a formula bolted on as a flat bonus, edited
  in the combat section of `/config/skills`.
- ROLL-03/04 landed ladders and rolling with no consumer.

## Desired result (to-be)

- `RollDefinition` entity `{ id, name, description, input: formula, ladderId, category?:
  'offence' | 'defence' | 'utility', order }`. `input` evaluates in the character context —
  `stats.*`, `skills.*` (level/bonus), `const.*` (a FORM-04 scoping-table row) — so "evasion
  reads Dex and armour" is a formula edit.
- A Rolls panel (domain shape + dashboard card) editing definitions **and** ladders (ROLL-03's
  entity gets its editor here); guarded deletes via REF-02 both ways (a ladder used by a
  definition; a definition — once ROLL-06 rolls it into history — safe to delete, history is
  session-only).
- Fresh-config seeds: the `[20, 12, 6]` ladder and the four rolls with placeholder inputs
  (`stats.str` melee, `stats.dex` ranged/evasion, `stats.con` endure), descriptions naming them
  placeholders — the true evasion/endure expressions are spec open question #1.

## Acceptance criteria

- [ ] Definition and ladder CRUD persist via store actions; export/import round-trips both.
- [ ] Input formulas validate in the character context: unknown refs named, cycles blocked at save (FORM-04 rules applied to the new attachment point).
- [ ] Seeds present with placeholder-labelled descriptions.
- [ ] Panel follows the domain shape, `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: edit a roll's input and ladder. (Ask the User first per CLAUDE.md.)

## Notes

- `applies_to` (creature rolls) and `visibility` wait for the creature milestone / a second view;
  both additive.
- `CombatSkill` stays alive until ROLL-06 — this ticket adds alongside, that one removes.
