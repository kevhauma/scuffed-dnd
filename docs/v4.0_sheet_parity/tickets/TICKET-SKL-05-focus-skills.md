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

## Implementation notes (2026-08-29)

Four decisions the ticket left open, taken here rather than discovered later.

1. **The neutral multiplier is a third of a slot, not a special case.** Under
   [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29) the
   engine names the constants and the data pass supplies 1.5 / 0.3, so the engine needs a reading for
   a ruleset that states neither. Each dial defaults to `1 / FOCUS_SLOT_COUNT`, so three neutral
   slots multiply by **exactly 1** — one rule, no branch, and a ruleset that states only
   `focus_chosen` gets the reading that follows from it rather than a silently ignored constant.
2. **Who insists on three.** *At most three, all naming real skills* is the field's rule
   (`focusPickRefusal`) and both writes share it. *All three filled* is **creation's** rule
   (`focusErrors`), and only when the ruleset states a dial — `archetypeErrors`' shape, for its
   reason: with no dials every multiplier is 1, so demanding three picks that change nothing is a
   rule a Player cannot act on. The **sheet's picker deliberately accepts fewer**, because a
   character created before focus existed has none and the Notes below ask for exactly that path.
3. **The ceil stays inside the `+ invested`** (SKL-04's open question, re-opened here as its handoff
   asked). The level can still render `13.5` for the golden suite's inferred 1.5-point pick; every
   write refuses a non-integer investment, so moving the ceil outside would round a number the
   workbook does not round, to tidy a case the workbook does not have.
4. **Three slots stays an engine constant.** RACE-04's ruling would make it `const.focus_slots` the
   day a ruleset asks for four; nothing asks, and the neutral share is derived from the count rather
   than written as `0.3333`, so the dial has a seat when it is wanted.

`SUPPORTED_SCHEMA_VERSION` is **not** bumped: `focusSkillIds?` is additive-optional and absent means
none, so a stored roster round-trips unchanged. D6's single bump is still DX-09's to make.

**Corrected in the `conventions-reviewer` pass** (2026-08-29), each recorded because the reasoning
outlives the fix:

- **The picks never reached the server on creation.** `createSessionCharacter` builds its request
  field by field and the new field was missing, so creation at a table lost all three picks — and,
  because the route re-runs `characterCreationErrors`, was **refused outright** on any Snapshot
  stating a focus dial. The criterion above was ticked on the *action* route and never on the
  *creation* route; that is the lesson, not the three-line fix.
- **The guarded delete could not see a focus pick.** `skillEntityReferences` counted formulas and
  invested points only, so a skill three characters focus could be deleted — and a dangling focus id
  is worse than a dangling race id, because `focusPickRefusal` refuses the whole list and the
  picker resends it, making every slot unwritable over one the Player never touched.
- **Two spellings of *none*.** Creation dropped an empty list while the sheet's picker stored `[]`.
  The rule is now `focusPicksField`'s alone, and clearing the last pick **removes** the field.
- **The wizard step's message is not the Kernel's**, and its JSDoc no longer claims otherwise: the two
  refuse the same *character*, each in the words its own surface should use.

## Acceptance criteria

- [x] The three modifier tiers reproduce at 1.5/0.3: unchosen 0.9, chosen-once 2.1, chosen-twice
      3.3 — engine tests against a fixture of the ticket's own; a ruleset setting neither constant
      computes every skill exactly as before.
      (`shared/engine/focusSkills.test.ts` *the three modifier tiers* — 0.9 / 2.1 / 3.3 against
      `SHEET_DIALS`, the ticket's own fixture; and *a ruleset that states no focus dials* asserts
      `toBe(1)` exactly, picks or no picks. End to end through the calculator in
      `skillCalculator.test.ts` *the focus multiplier* — "leaves every skill exactly as it was for a
      ruleset that states neither dial" and "reproduces the three tiers on one skill".)
- [x] A character with no `focusSkillIds` computes every skill at 0.9 — absent-means-none pinned;
      a fourth pick or a non-existent skill id is a refused edit / validation finding, not a
      silent trim.
      (`focusSkills.test.ts` "gives every skill 0.9 when the character has made no picks at all" and
      the `focusPicksOf` block; `skillCalculator.test.ts` "computes a character with no picks at 0.9
      everywhere". The refusals are one Kernel rule, `focusPickRefusal`, asserted at all three of its
      callers: `focusSkills.test.ts` *focusPickRefusal*, `characterCreation.test.ts` *focus skills*
      — "refuses a fourth pick rather than trimming it" — and `playerActions.test.ts` *choosing focus
      skills*, whose "refuses a skill this ruleset does not have" also pins the character unchanged.)
- [x] Invested points are added after the multiplied-and-ceiled term — pinned by a case where the
      order changes the answer.
      (`skillCalculator.test.ts` "adds invested points after the multiplied-and-ceiled term, which
      changes the answer": `ceil(4.5 × 2.1) + 3 = 13`, where invested-inside gives 16 and
      rounded-before-multiply gives 13.5. The engine line is
      `roundAwayFromZero(weighted * multiplier) + invested` in `skillCalculator.ts`.)
- [x] Persistence goes through the store action (wizard writes via `characterStore` /
      creation service); the server re-derives through the same calculator.
      (`characterStore.setFocusSkills` is the only writer on the browser path — asserted in
      `characterStore.test.ts` *setFocusSkills*, including the refusal reaching `actionError` and
      `saveCharacters` **not** being called; the sheet's picker calls it through
      `useSheetActions.handleSelectFocusSkill` and nothing else, pinned by
      `CharacterSheet.test.tsx` "should write a pick through the store". Creation writes through
      `buildCharacter`. The server side is **two** routes, and the review is why both are named here:
      `POST /api/characters/:id/set-focus-skills` (`server/routes/play/setFocusSkills.ts`, pinned by
      `play.test.ts` *choosing focus skills at a table*; `playerRules.test.ts` counts one route module
      per `PLAYER_ACTION` value) **and** `POST /api/sessions/:id/characters`, which is where the
      first pass was broken — the picks never reached it, so on a dialled Snapshot creation at a
      table was impossible. `CharacterCreateRequest` carries `focusSkillIds`, `createSessionCharacter`
      sends it and `creationDataFrom` reads it, pinned by `characters.test.ts` *focus skills* (five
      cases). Both routes take their rules from the Kernel and re-derive through the same
      `skillCalculator`.)
- [x] Unit tests cover: the three tiers, duplicate stacking, absent default, invested-after,
      and the wizard step's refuse-fewer-than-three-or-none rule (whichever the ticket decides:
      the sheet's Setup always names three).
      (**+55 tests, one new file** — 47 from the build and 8 from the review; see TEST_STATUS.md. Duplicate stacking is pinned four times over:
      the engine's 3.3, the creation rule's "takes duplicates", the wizard carrying `['STL','ALC',
      'STL']` onto the created character, and the sheet showing `× 3.3` on **both** slots naming one
      skill. The step rule is `CharacterCreationWizard.test.tsx` *the focus step* — "should draw
      three pickers and refuse to leave until all three are filled" and "should ask for nothing on a
      ruleset that states neither dial"; note 2 above says why that is the rule.)
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus ~~a live browser check of the wizard step and a stacked pick~~ (ask the User
      first).
      (Left open for its **browser** clause only: the browser check was skipped by User instruction
      for this run. The rest is done — `npx vitest run` 3256/3256 with 0 skipped, `npx tsc --noEmit`
      at its documented 2-error baseline, `yarn run check` clean, and `fallow audit --base main`
      reporting `dead_code_introduced: 0` and `complexity_introduced: 0`. The `conventions-reviewer`
      pass runs on the diff before the commit.)

## Notes

- Whether an existing character (created before focus skills) must pick three or stays at
  absent-means-none is a play-mode affordance question — the sheet affordance covers it; the
  default is the honest 0.9-everywhere. **Answered: absent-means-none, and the sheet's picker fills
  the slots one at a time** (implementation note 2). Its dropdowns carry an explicit *No focus*
  entry rather than `Select`'s disabled placeholder, so a focus can be given up as well as swapped;
  the wizard keeps the placeholder, where an empty slot is a step error rather than a choice.
- **The skills grid gained a `focus × 2.1  +5.7` breakdown row**, and it had to. The rows above it
  are `weight × stat` addends that used to sum to the number the level rounds up from; a multiplier
  applied silently would have left forty-eight breakdowns that no longer add up. The engine reports
  the multiplier **and what it contributed** (`CalculatedCharacter.skillFocus`) so no component
  re-derives it. The row is omitted entirely for a ruleset that states no dials — `focus ×1 +0` on
  every skill says only that a feature exists.
- `optionalConstant` joined `namedConstant` in `engine/formula/constants.ts`, and `namedConstant` is
  now that plus `?? fallback`. This ticket is the first caller that has to tell *unset* from *set to
  what the fallback would have been*.
- Focus *stats* (retired, ARC-03) and focus *skills* share a word and nothing else; the ticket
  should not resurrect any focus-stat machinery.
