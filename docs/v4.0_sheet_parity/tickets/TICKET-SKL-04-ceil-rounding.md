# TICKET-SKL-04 — Skill levels and bonuses round with ceil

- **Area:** Skills engine
- **Type:** Feature (engine rounding)
- **Traceability:** System [06 · Skills and focus](../systems/06-skills-and-focus.md) (gaps 1, 3);
  overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) ("Fix them" — the two sheet
  formula bugs, which the data pass fixes in the weights).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the skill list and its weights are seeded values, so they are the data pass's. It owes this
> ticket [skills.json](../../imports/skills.json) re-sourced: drop `sewing` and the duplicate
> `Skinning` (the creator resolved it — one `skinning` remains), add `Summening` and
> `woodcrafting`, apply the recapitalisations, and re-weight all 48 per systems/06 — mono = one row
> at **0.35**, duo = **0.2 + 0.1** — with the secondary weight on the *listed* secondary stat and
> Summening on its own Wis/Int row. Those two are the reference table's **intent**, not what the
> sheet's formulas compute; the ruling says build the intent, and the fragment's `notes` records
> the divergence so DX-09's fixtures pin corrected arithmetic.

## User story

As a Player, I want my skill levels and bonuses rounded the way the sheet rounds them, so a
half-point of stat scaling does not disappear off my sheet.

## Description

The sheet rounds both halves of a skill **up**: level = `ROUNDUP(Σ(weight × stat)) + invested`,
bonus = `ROUNDUP(level / 5)`. The app leaves the level fractional and rounds the bonus to nearest.
This ticket moves both to `ceil` — the whole engine change §5 needs, and the one that has to land
before the data pass re-weights anything, because every re-weighted number would otherwise be
pinned against the wrong rounding.

## Current situation (as-is)

- [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts): level =
  `Σ(weight × stat) + invested` with **no rounding** (fractional), bonus =
  `round(level / const.bonus_divider)`. The sheet says `ROUNDUP` for both; the divisor is 5 in both
  workbooks and does not move.
- `Skill.statWeights: [{statId, weight}]` (TICKET-SKL-02) already expresses whatever weights the
  data pass brings — mono, duo, or anything else. No shape change is needed for the re-weight.
- Formulas reach a skill as `skills.<name-slug>`, first-one-wins on shared spellings
  (TICKET-SKL-02's rule); renames are safe (TICKET-REF-01).

## Desired result (to-be)

- **Ceil, twice**: level = `ceil(Σ(weight × stat)) + invested` — invested points added *after* the
  ceil, so a bought point stays a whole point — and bonus = `ceil(level / bonus_divider)`.
- **The focus multiplier's future seat is left open**: TICKET-SKL-05 slots its multiplier *inside*
  the ceil, so write the expression with that shape in mind rather than requiring a rewrite.
- **Engine rule or ruleset data**: decide in the ticket whether the rounding mode is a fixed engine
  rule or a per-ruleset dial, and record which — remembering that an imported ruleset plays
  whatever the engine does, so a dial nobody sets is an abstraction with one caller.

## Acceptance criteria

- [ ] Level and bonus both round with `ceil`; `bonus_divider` = 5 unchanged; fractional inputs
      pinned on both sides of a boundary and exactly on it.
- [ ] Invested points are added after the level's ceil — pinned by a case where the order changes
      the answer.
- [ ] Every existing skill test that assumed fractional levels or nearest-rounding bonuses is
      updated to the new rule with its expected value restated, not deleted.
- [ ] Derived values come from `skillCalculator` only; no second summation and no caller rounding
      before or after — a grep at the call sites stays empty.
- [ ] The rounding-mode decision is recorded in this ticket, and if it landed as ruleset data, the
      absent default reproduces the sheet.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the skills grid (ask the User first).

## Notes

- **Land this before the data pass re-weights.** Re-weighting against the old rounding would pin
  48 numbers that then all move.
- Focus skills (the multiplier, the character field, the wizard step) are **TICKET-SKL-05**; gear
  skill bonuses land with TICKET-ITEM-01/TICKET-INV-05.
- Two skills sharing a spelling stops being a real case when the data pass merges the duplicate,
  but the first-one-wins reference rule stays as is — it is the namespace's rule, not that data's.
