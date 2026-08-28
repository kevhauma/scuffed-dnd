# TICKET-SKL-04 — Skills re-scaled: the new list, primary/secondary weights, ceil rounding

- **Area:** Skills configuration / engine
- **Type:** Feature (data revision + engine rounding)
- **Traceability:** System [06 · Skills and focus](../systems/06-skills-and-focus.md) (gaps 1, 3);
  overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) ("Fix them" — the two
  sheet formula bugs).

## User story

As a User, I want every skill weighted by its primary and secondary stat the way the new sheet's
reference table intends — and levels rounded the way its formulas round — so skill numbers match
the table's.

## Description

Still 48 skills, but not the same 48, and every one gains a primary (0.35 mono, or 0.2 duo) and
optional secondary (0.1) stat. The app builds the reference table's **intent**: the sheet's two
formula bugs (the secondary stat never read; Summening scaling off Stealing's row) are fixed, not
reproduced — ruled 2026-08-29. Rounding moves to `ceil` in both the level and the bonus.

## Current situation (as-is)

- [skills.json](../../imports/skills.json) carries the old list — including `sewing` and the
  deliberate duplicate `Skinning`/`skinning` — with old weights (0.2/0.3 monos, the old duo
  pairs). `Skill.statWeights: [{statId, weight}]` (TICKET-SKL-02) already expresses the new shape.
- [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts): level =
  `Σ(weight × stat) + invested` with **no rounding** (fractional), bonus =
  `round(level / const.bonus_divider)` — the sheet says `ROUNDUP` (ceil) for both, divisor 5
  unchanged.
- Renames are safe (TICKET-REF-01); formulas reach a skill as `skills.<name-slug>`, first-one-wins
  on shared spellings (TICKET-SKL-02's rule).

## Desired result (to-be)

- **The list edits**: drop `sewing` and the duplicate `Skinning` (the creator resolved it — one
  `skinning` remains, its merge note retiring); add `Summening` and `woodcrafting`; apply the
  recapitalisations (alchemy→Alchemy etc.).
- **Re-weight all 48** per systems/06's table — mono = one row at 0.35, duo = 0.2 + 0.1 rows,
  with the secondary stat genuinely the *listed* stat (the table's intent, not the sheet's
  copy-fill slip) and Summening on its own Wis/Int row.
- **Rounding to ceil, twice**: level = `ceil(Σ(weight × stat)) + invested` (the focus multiplier
  slots inside the ceil when TICKET-SKL-05 lands), bonus = `ceil(level / bonus_divider)`. Decide
  in the ticket whether the mode is engine rule or ruleset data — remembering imported rulesets
  play whatever the engine does.

## Acceptance criteria

- [ ] All 48 seeded skills carry the table's weights; a duo skill's level includes
      `secondary stat × 0.1` with the **secondary** stat's value — pinned by a test naming
      Athletics (secondary term = Strenght × 0.1, not Dex × 0.1), the case the sheet gets wrong.
- [ ] Summening scales off Wis 0.2 + Int 0.1 — its own row, not Stealing's — pinned.
- [ ] Level and bonus both round with `ceil`; `bonus_divider` = 5 unchanged; fractional inputs
      pinned on both sides of a boundary.
- [ ] [skills.json](../../imports/skills.json) re-sourced to the new workbook with `source.ranges`
      cited, and the two sheet bugs recorded in `notes` as a divergence between what the sheet
      computes and what it means (the ruling's wording) — so TICKET-DX-09 pins fixtures from the
      corrected arithmetic, not the captured duo-skill levels; `yarn run sheet:import` regenerated.
- [ ] Derived values come from `skillCalculator` only; no second summation anywhere.
- [ ] Unit tests cover: mono at 0.35, duo secondary-stat reading, the two bug-fix cases, ceil
      boundaries, and the list count staying 48.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the skills grid (ask the User first).

## Notes

- Focus skills (the multiplier, the character field, the wizard step) are **TICKET-SKL-05**; gear
  skill bonuses land with TICKET-ITEM-01/TICKET-INV-05. This ticket is the list, the weights, and
  the rounding.
- Two skills sharing a spelling stopped being a real case when the duplicate merged, but the
  first-one-wins reference rule stays as is — it is the namespace's rule, not this data's.
- The focus-constant placement question (per-ruleset dials) is SKL-05's to decide.
