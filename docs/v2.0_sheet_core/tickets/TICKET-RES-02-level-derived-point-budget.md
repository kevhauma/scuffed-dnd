# TICKET-RES-02 — Level-derived point budget

- **Area:** Resources & progression
- **Type:** Refactor (retires the flat budget; supersedes v1.0's level-up out-of-scope decision)
- **Traceability:** Concept [06 · Curve](../../excel%20export%20summary/concepts/06-curve.md) (§ the progression loop); Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md) (`points_per_level`)

## User story

As a Player, I want my point budget to grow with my level — `level × points_per_level` — so
levelling up gives me something to spend, the way the sheet's confirmed formula works.

## Description

The sheet's budget is `level × points_per_level − points_spent` (confirmed from
`Charactersheet!E17`). The app's is a flat config number with "absent means unlimited". With
RES-01's level in place, this ticket derives the budget and retires the flat pool.

## Current situation (as-is)

- `Configuration.mainSkillPointBudget?` with absent-means-unlimited, enforced by
  [`skillAllocation.ts`](../../../src/engine/skillAllocation.ts) and edited by
  [`MainSkillPointBudget`](../../../src/components/config/skills/main/MainSkillPointBudget.tsx)
  (TICKET-SKL-01's deliverable — superseded).
- v1.0 deliberately scoped allocation to creation time; the spec makes ongoing allocation the
  level-up mechanic.

## Desired result (to-be)

- **Points available = `level × const.points_per_level`**; `validateStatAllocation(character,
  config)` (successor of `validateMainSkillAllocation`) reports spent / available / remaining and
  violations from the derived budget; wizard and sheet consume it, summing nothing themselves.
- `mainSkillPointBudget` is deleted from the type, store, shape validation, and UI — no
  "unlimited" fallback remains.
- Allocation revalidates whenever level changes; unspent points simply remain spendable — that
  *is* the level-up mechanic, no separate wizard.

## Acceptance criteria

- [ ] Budget derivation tested: level change and constant change both move it; creation validates against level-at-XP-0's budget.
- [ ] Boundary tests preserved in spirit from SKL-01: exactly at budget valid, one over invalid.
- [ ] `mainSkillPointBudget` gone (grep criterion); shape validation rejects it in v2 files as unknown rather than silently ignoring — consistent with IO-03's strictness.
- [ ] The sheet exposes remaining points when they exist (spend surface may be minimal — the wizard's allocation UI reachable post-creation, per the existing pattern).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.
- [ ] Verified live in the browser: gain a level, see spendable points appear, spend one. (Ask the User first per CLAUDE.md.)

## Notes

- ARC-02 changes what a spent point *buys* (curve-routed gains); this ticket only changes how
  many points exist. Keep the validator's shape ready for per-stat gain reporting.
- `starting_points` (does a fresh character get bonus points?) is a spec open question — level 1
  budget is the answer until the User says otherwise; note it in the module JSDoc.
