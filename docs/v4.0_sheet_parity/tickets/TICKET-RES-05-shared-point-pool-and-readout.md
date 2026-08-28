# TICKET-RES-05 — One point pool for stats and skills, with the readout

- **Area:** Progression (point budget)
- **Type:** Feature (budget widening + display)
- **Traceability:** System [02 · Progression and identity](../systems/02-progression-and-identity.md)
  (gaps 3–4); the xlsx's `Points to Use = level × 3 − Points Spend` summing stat *and* skill boxes
  (`Background Charater Sheet Calcu` AK3:AK4).

## User story

As a Player, I want my stat points and skill points paid from the one budget the sheet prices —
with Points to Use and Points Spend on my sheet — so a point spent anywhere costs the same pool.

## Description

The sheet has **one shared pool**: `level × 3` (plus DM grants, TICKET-DM-01) pays for both stat
investment and skill investment, and the Character Sheet shows the Points to Use / Points Spend
pair. Today the app budgets stat points only; skill investment is free. The fix is where the spend
is summed, not the refusal discipline.

## Current situation (as-is)

- [skillAllocation.ts](../../../src/shared/engine/skillAllocation.ts)'s `validateStatAllocation`
  prices the pool as `level × const.points_per_level + grantedStatPoints` (TICKET-RES-02,
  TICKET-DM-01) — over **stat** investment only.
- Skill invested points exist (`level = … + invested`, TICKET-SKL-02) but no budget covers them;
  a Player can invest skill points without limit.
- `points_per_level` = 3 in [constants.json](../../imports/constants.json) — the new sheet's
  *Points scaling* is the **same 3**, confirmed unchanged.
- Refusals are the house discipline: an unaffordable spend is refused naming the overspend, never
  clamped (RES-02, DM-01).

## Desired result (to-be)

- **The budget covers the sum**: `level × points_per_level + grants` prices
  `investedStatPoints + investedSkillPoints` together in `validateStatAllocation` (or its widened
  successor — one validator, both spends; the server re-derives through the same Kernel rule).
- **Refusal discipline unchanged**: an unaffordable spend on either side is refused with the
  overspend named; nothing is clamped; existing DM-grant behaviour (raise never refused, revoke
  refused when it strands an overspend) keeps passing.
- **The readout**: Points to Use / Points Spend rendered on the sheet header where the sample
  shows them (`Character Sheet` K1:L3), both read from the widened allocation result — display
  only, nothing recomputed inline.

## Acceptance criteria

- [ ] A character whose stat + skill investment together exceed the pool is refused on the next
      spend of either kind, with the overspend named — engine tests covering stat-then-skill and
      skill-then-stat orderings.
- [ ] A previously-legal allocation that the widened budget can no longer afford is *reported*
      (validation surface), not silently rewritten — the same treatment RES-02 gave overspends.
- [ ] The sheet header shows Points to Use / Points Spend matching the sample (level 1, 3 spent →
      0 to use, 3 spend), sourced from the allocation result — component test plus engine test.
- [ ] DM grant round-trips still pass unchanged (`dm.test.ts`'s grant/revoke cases now priced over
      the summed spend).
- [ ] The sheet's own double-count quirk (the SUM listing `D10` twice) is recorded in the
      fragment's `notes` as a sheet bug surfaced, not copied.
- [ ] Unit tests cover: sum priced across both spends, refusal naming, readout values, grant
      interaction.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of a refused over-budget skill spend (ask the User first).

## Notes

- This lands the rest of plan §14 after TICKET-RES-04 took the Dream level half; the two halves
  are deliberately separate because ARC-04 needs the field and nothing needs the pool.
- Behavioural for every ruleset: skill investment stops being free. The corpus's sample character
  is affordable (3 points, all stat-side); any seeded character that is not becomes a validation
  finding, which is the correct surface for it.
