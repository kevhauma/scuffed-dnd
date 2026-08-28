# TICKET-SKL-05 — Focus skills multiply growth

- **Area:** Skills / character creation
- **Type:** Feature
- **Traceability:** System [06 · Skills and focus](../systems/06-skills-and-focus.md) (gaps 2, 4);
  the xlsx's per-slot `IF(slot = this skill, chosen, others)` modifiers
  (`Background Setup Calculations ` B4:E51). **Needs TICKET-SKL-04** (the ceil-rounded calculator
  the multiplier enters).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the engine names the two constants it reads; their *values* are the data pass's. It owes this
> ticket `focus_chosen` **1.5** and `focus_other` **0.3** in
> [constants.json](../../imports/constants.json), cited to the sheet's *Enhanced scaling* block.

## User story

As a Player, I want to choose three focus skills that multiply my growth — a duplicate pick
stacking — so my character specialises the way the sheet's Setup form allows.

## Description

Focus skills return (v2.0 retired focus *stats* in TICKET-ARC-03; this is a different, per-skill
concept). Three slots, duplicates legal: each slot contributes 1.5 to the skills it names and 0.3
to every other, summing to a per-skill multiplier — unchosen 0.9, chosen once 2.1, chosen twice
3.3. Invested points land *after* the multiplier: a bought point is a full point.

## Current situation (as-is)

- No focus concept exists.
  [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts) computes
  `ceil(Σ(weight × stat)) + invested` after TICKET-SKL-04 — no multiplier.
- The wizard ([useCharacterCreation.ts](../../../src/client/components/play/creation/useCharacterCreation.ts),
  TICKET-CHAR-02/ARC-03) has no focus-skill step; the sheet has no picking affordance.
- [constants.json](../../imports/constants.json) has no focus constants; the sheet's *Enhanced
  scaling* block holds chosen **1.5** / others **0.3**.

## Desired result (to-be)

- **`Character.focusSkillIds?: string[]`** — exactly 3 slots when present, duplicates allowed,
  absent-means-none (every multiplier 0.9, the sheet's own unchosen arithmetic).
- **Two constants + the multiplier in the engine**: `focus_chosen` and `focus_other` as per-ruleset
  `Constant` rows the engine reads by name (systems/06's open question, answered here: they are the
  User's dials, beside `bonus_divider`) — **absent means neutral**, so a ruleset that sets neither
  computes exactly as it does today. The level becomes
  `ceil((Σ weight × stat) × focusModifier) + invested` — invested after the multiply, exactly as
  read from the cells.
- **A wizard step and a sheet affordance** to pick the three, duplicates legal and visibly
  stacking.

## Acceptance criteria

- [ ] The three modifier tiers reproduce at 1.5/0.3: unchosen 0.9, chosen-once 2.1, chosen-twice
      3.3 — engine tests against a fixture of the ticket's own; a ruleset setting neither constant
      computes every skill exactly as before.
- [ ] A character with no `focusSkillIds` computes every skill at 0.9 — absent-means-none pinned;
      a fourth pick or a non-existent skill id is a refused edit / validation finding, not a
      silent trim.
- [ ] Invested points are added after the multiplied-and-ceiled term — pinned by a case where the
      order changes the answer.
- [ ] Persistence goes through the store action (wizard writes via `characterStore` /
      creation service); the server re-derives through the same calculator.
- [ ] Unit tests cover: the three tiers, duplicate stacking, absent default, invested-after,
      and the wizard step's refuse-fewer-than-three-or-none rule (whichever the ticket decides:
      the sheet's Setup always names three).
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of the wizard step and a stacked pick (ask the User first).

## Notes

- Whether an existing character (created before focus skills) must pick three or stays at
  absent-means-none is a play-mode affordance question — the sheet affordance covers it; the
  default is the honest 0.9-everywhere.
- Focus *stats* (retired, ARC-03) and focus *skills* share a word and nothing else; the ticket
  should not resurrect any focus-stat machinery.
