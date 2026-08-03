# TICKET-MAT-01 — Material modifiers target stats

- **Area:** Materials configuration
- **Type:** Refactor (breaking change to the modifier shape)
- **Traceability:** Concept [09 · Material family](../../excel%20export%20summary/concepts/09-material-family.md) (tier `mods` are per-stat)

## User story

As a User, I want a material tier to grant stat modifiers — "+50 Mana", "+1 Str" — so equipment
affects what the sheet says it affects.

## Description

Sheet material mods are keyed by stat (fur tier 1: Mana 50, Health 1); the app keys every
modifier by skill code and cannot touch a stat. This ticket changes the modifier shape and the
materials editor; the equipment aggregation rework is TICKET-MAT-02.

## Current situation (as-is)

- [`SkillModifier`](../../../src/types/config.ts) `{ skillCode, modifier }` on
  `MaterialLevel.bonuses`;
  [`useMaterialManager`](../../../src/components/config/materials/useMaterialManager.ts) offers
  main + speciality + combat codes as targets.
- Post-STAT-01, main-skill codes resolve as stat abbreviations only via the temporary bridge — a
  naming coincidence, in the wrong shape.

## Desired result (to-be)

- `StatModifier` `{ statId, modifier }` replaces `SkillModifier` on `MaterialLevel.bonuses`.
- The material-level dialog picks **stats** — resource stats included ("+50 max Mana" becomes
  expressible); a modifier on a *derived* stat is a named validation error (its formula is its
  source).
- `engine/validator.ts` checks modifier stat ids; REF-02 guards stat deletion against modifiers;
  export/import shape validation updated.

## Acceptance criteria

- [ ] `MaterialLevel.bonuses` is `StatModifier[]` in type, store actions, and shape validation; export → import round-trips.
- [ ] The dialog offers invested and resource stats, rejects derived stats with a message (component test).
- [ ] Dangling `statId` reported by the validator; guarded delete covers modifier references.
- [ ] Persistence via store actions; components compose `ui/` primitives, theme tokens only.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Race modifiers already moved (RACE-01); after this ticket plus ROLL-06, no skill-code-keyed
  modifier shape remains anywhere — ROLL-06 carries that grep criterion.
- Material family *generators* (`base_*`, tier formulas, `usable_for`) are the later materials
  milestone, on CRV-02's machinery.
