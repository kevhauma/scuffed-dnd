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

- [x] Budget derivation tested: level change and constant change both move it; creation validates against level-at-XP-0's budget. (`src/engine/skillAllocation.test.ts` → *the derived budget*: `should price the pool as level × points_per_level`, the `it.each` over 0/300/900/2700 XP → 5/10/15/20 points, `should move the budget when the constant changes, at an unchanged level`, `should fall back to Concept 05's seeded 3 when the ruleset names no such constant`, and `should validate a character at creation against level-at-XP-0's budget`.)
- [x] Boundary tests preserved in spirit from SKL-01: exactly at budget valid, one over invalid. (`src/engine/skillAllocation.test.ts` → *the boundaries, preserved from TICKET-SKL-01*: `should accept an allocation exactly at the budget`, `should reject an allocation one point over the budget`, plus `should treat a budget of zero as "no points to spend", not as unlimited`.)
- [x] `mainSkillPointBudget` gone (grep criterion); shape validation rejects it in v2 files as unknown rather than silently ignoring — consistent with IO-03's strictness. (`grep -rn mainSkillPointBudget src` returns only the retired-field map in [`importExport.ts`](../../../src/services/importExport.ts), the tests asserting the refusal, and the `schemaVersion` history comment — the type field, the store action, the `StatPointBudget` component and its test are deleted. `RETIRED_FIELDS` drives `retiredFieldErrors`; covered by `src/services/importExport.test.ts` → *retired fields (TICKET-RES-02)*, including the zero case a falsy presence check would have let through.)
- [x] The sheet exposes remaining points when they exist (spend surface may be minimal — the wizard's allocation UI reachable post-creation, per the existing pattern). (`StatsSection` renders `PointBudgetSummary` in its header and an `InvestedPointsEditor` per non-derived stat; `src/components/play/sheet/CharacterSheet.test.tsx` → *the derived point budget*: `should state the pool the character's level grants and what is left of it` (10 of 15 · 5 remaining), `should move the pool when experience moves the level`, `should spend a point through the store and show the pool shrink`, `should refuse a spend the pool cannot pay for`, and `should chip the pool rather than showing zero when the level cannot be read`. **Divergence from the parenthetical, see implementation note 3**: there is no post-creation wizard route to reach, so the spend surface is on the sheet itself rather than the wizard's step.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the Verification section below.)
- [ ] Verified live in the browser: gain a level, see spendable points appear, spend one. (**Left open — the User declined the live check for this run and for the remaining v2 tickets**, asked and answered 2026-08-16. The behaviour is covered by `CharacterSheet.test.tsx`'s *the derived point budget* group against the real store, but nothing here has been seen in a browser.)

## Implementation notes

1. **`validateStatAllocation` takes the whole `Character`, not its allocation map.** The budget is
   priced off the character's experience, so one call has to answer both "how many points do they
   have" and "how many have they spent" — splitting those across two arguments is how the two drift
   apart. The wizard hoists the draft it is about to save (experience 0) and passes that, which is
   what makes creation validate against level-at-XP-0's budget rather than against a special case.
2. **`pointBudget` and `pointsRemaining` are `FormulaResult`s, and an unavailable budget is
   `isValid: false`.** RES-01 made the level a `FormulaResult` precisely because a confident level 1
   would misprice every budget derived from it; the budget inherits that. The alternative — treating
   an unreadable level as "unlimited" — would let a Player spend points the ruleset never granted,
   which is the failure mode the whole errors-as-values design exists to prevent (Concept 00 §7).
   The consequence is real: delete the `xp_thresholds` curve and the allocation step refuses to
   advance, saying so in words.
3. **The spend surface is the sheet, not the wizard.** The to-be's parenthetical assumed "the
   wizard's allocation UI reachable post-creation, per the existing pattern" — there is no such
   pattern: `/play/create` is a create-only route and no edit route exists. Rather than invent one,
   an invested stat now gets an `InvestedPointsEditor` row on the sheet *as well as* its breakdown
   row, exactly the way STAT-03 gave a resource the `StatEditor` as well. That keeps "what is this
   stat" and "how many points are in it" as two readable lines, and it puts the level-up spend where
   the Player already is when they gain a level.
4. **`points_per_level` is read by name, seed 3.** The third constant to be — after
   `const.bonus_divider` (SKL-02) and `const.race_blend_divisor` (RACE-02) — and it inherits their
   consequence: this is system arithmetic rather than a User formula, so `references.ts` has nothing
   to re-spell and renaming the constant falls back to the seed rather than following. Zero is
   accepted as a legitimate ruleset ("levels grant no points"); only a negative or non-finite value
   falls back.
5. **Retiring a persisted field is now a refusal, not a drop.** `RETIRED_FIELDS` in
   `importExport.ts` maps each removed key to what replaced it and `validateConfiguration` errors on
   its presence, because importing a file authored under rules this build no longer applies would
   produce a ruleset that plays differently from the one the User exported. That is the pattern for
   every later removal in this milestone; it is recorded in the `data-model` skill.
6. **`SUPPORTED_SCHEMA_VERSION` 6 → 7**, per RACE-01's inherited decision. Rippled to 41 fixtures,
   `scripts/build-sheet-import.mjs` and `examples/demo-ruleset.json`.
7. **`starting_points` stays open.** Concept 20 does not say whether a fresh character gets a bonus
   pool on top of level 1's; the sheet has no such cell either. Level 1's budget is the starting
   budget until the User decides otherwise, noted in the module JSDoc and in
   [`docs/imports/constants.json`](../../imports/constants.json).

## Sheet data

No new persisted entity, but [`docs/imports/constants.json`](../../imports/constants.json) is
brought forward: `points_per_level` is load-bearing now rather than seeded-ahead-of-use, so the
fragment cites `Charactersheet!E17` (the sheet's own `level × points_per_level − points_spent`) and
records both that the retired `mainSkillPointBudget` was never sheet data and that the sheet has no
`starting_points` cell to import. `yarn run sheet:import` rerun; `ducklets.json` regenerated at
`schemaVersion: 7`.

## Verification

- `npx vitest run` — see the run recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- `npx tsc --noEmit` — the documented 2-error baseline, unchanged.
- `yarn run check` — clean.

## Notes

- ARC-02 changes what a spent point *buys* (curve-routed gains); this ticket only changes how
  many points exist. Keep the validator's shape ready for per-stat gain reporting.
- `starting_points` (does a fresh character get bonus points?) is a spec open question — level 1
  budget is the answer until the User says otherwise; note it in the module JSDoc.
