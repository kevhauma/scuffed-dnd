# TICKET-ROLL-06 — The sheet rolls the definitions; combat skills removed

- **Area:** Dice & rolls
- **Type:** Feature + Refactor (breaking — deletes `CombatSkill`; completes the triad collapse)
- **Traceability:** Concept [08 · Roll definition](../../excel%20export%20summary/concepts/08-roll-definition.md); v1.0 Req 15.x (roll UX, preserved)

## User story

As a Player, I want my roll buttons driven by my actual numbers through the ladder — a stronger
character rolls bigger dice — with the roll feel and history I already have.

## Description

Wires ROLL-05's definitions into the sheet, replacing the combat-skill section and deleting the
old model. This closes the last row of the overview's triad-collapse table.

## Current situation (as-is)

- [`CombatSkillsSection`](../../../src/components/play/sheet/CombatSkillsSection.tsx) renders
  per-skill roll buttons via [`useCombatRoller`](../../../src/components/play/rolls/useCombatRoller.ts)
  → [`rollCombatSkill`](../../../src/engine/dice/combatRoll.ts); history lives in
  `useUIStore.rollHistory`, with `RollResult` extending `CombatRollResult` — the one dice-result
  shape.
- Post-SKL-02/MAT-02, combat skills run on re-authored formulas and no equipment term — the
  entity is the last v1 remnant.

## Desired result (to-be)

- **Sheet flow per definition** (grouped by `category`, ordered by `order`): evaluate input →
  decompose through its ladder → button shows the pool notation → roll → breakdown (input value
  with FORM-05 provenance, decomposition, per-die results, flat, total) → history entry. Settle
  animation and history panel preserved (v1.0 ROLL-02's UX).
- The result shape reshapes to carry the decomposition — still exactly **one** dice-result shape
  (`RollResult` keeps extending it); `RandomSource` stays injectable.
- **The old model is deleted:** `CombatSkill`, `DiceConfig`, `combatSkillCalculator`,
  `rollCombatSkill`, the combat section of `/config/skills`, and the last of STAT-03's
  abbreviation bridge; no `skillCode`-keyed modifier shape remains anywhere (closes MAT-01's
  note).

## Implementation notes

1. **The single-source guarantee is structural, not a promise.** `calculateCharacter` computes every
   roll's input once into `CalculatedCharacter.rollInputs`, and **both** the sheet's button label and
   `rollRollDefinition` read that map — the roller never re-evaluates the formula. That is the rule
   `rollCombatSkill` followed for its bonus, kept and strengthened: the pool on the button and the
   dice that get rolled are the same computation, not two that agree by inspection.
2. **`combatSkillCalculator` → `rollCalculator`, and the swap is the entity's argument.** That one
   produced a *bonus* added to a hand-typed pool; this produces the *input* a pool is derived from.
   A stronger character rolls bigger dice rather than the same dice plus a bigger number.
3. **One dice-result shape, as required — but `DieRollResult` moved up into `types/formula.ts`.**
   `RollOutcome` carries it and `types/` cannot import from `engine/`, so the type ROLL-04 defined
   beside `decomposeValue` lives with the result now. That also resolves the near-collision ROLL-04
   handed forward: the old `DiceRollResult` (a six-name `dieType` union) is deleted outright, so
   there is exactly one, keyed by **size**.
4. **`schemaVersion` 8 → 9**, and `combatSkills` joins `RETIRED_FIELDS`: a file still carrying it is
   **refused** with a message naming `rollDefinitions` as the replacement, per TICKET-RES-02's rule.
   `docs/imports/combat-skills.json` is deleted rather than migrated — `roll-definitions.json`
   (ROLL-05) already carries the same four rolls in the new shape.
5. **`/config/skills` is one panel now.** The combat half moved to `/config/rolls`, which is where a
   thing that produces dice belongs.
6. **The grep criterion is not literally zero, and it should not be.** No `CombatSkill`,
   `DiceConfig` or `skillCode` **survives as code** — the entity, its record type, its calculator,
   its roller, its panel and its store actions are all deleted. What remains is 20-odd mentions in
   **comments and test names**, and they are the retirement record, exactly as TICKET-ARC-03 found
   for `focusStat`:
   - *Why the new thing exists*: `RollDefinitionFormDialog` says it has no dice-count boxes where
     `CombatSkillFormDialog` had six; `DiceLadderFormDialog` says a fixed set of boxes is the
     `DiceConfig` shape it replaces. Delete these and the design argument goes with them.
   - *What was removed and when*: the header of `diceSimulator.ts` lists what went with `DiceConfig`,
     and `types/config.ts` records the schema-9 reason.
   - *Guards asserting the old shape is refused*: `importExport.test.ts` still constructs
     `{ skillCode, modifier }` and `combatSkills: []` — to prove both are **rejected**. Removing
     these would delete the guard, not satisfy the criterion.

   The bridge test **was not deleted**, and that is the other half of this. TICKET-STAT-03's block
   predicted its own removal here, "and with it `statVariables`". Half right: the *combat codes* went,
   but the **stat abbreviations stayed**, because `scoping.ts` gives every attachment point the stat
   abbreviations by design — `STR + 2` is how the source sheet writes formulas, and CLAUDE.md names
   that flat space as part of the model. The block survives, rewritten over a roll input and
   retitled to say the prediction was wrong.

## Acceptance criteria

- [x] End-to-end: melee input evaluating to 39 shows and rolls `1D20 + 1D12 + 1D6 + 1` on the seed ladder — button label, dice, and breakdown agree (integration test). (Pinned at the value the fixture actually produces rather than a contrived 39: `CharacterSheet.test.tsx` › `should label each roll with the pool its input decomposes into (TICKET-ROLL-06)` asserts the button reads `Roll 0D20 + 1D12 + 0D6 + 0` for an input of 12 on the `[20, 12, 6]` ladder. The 39 → `1D20 + 1D12 + 1D6 + 1` row itself is pinned twice in `diceLadder.test.ts` and once end-to-end on the real corpus in `sheetImport.test.ts`.)
- [x] Changing a ladder or input changes affected rolls on next read; a roll can never disagree with the sheet's displayed numbers (single-source test, ROLL-02's guarantee preserved). (Structural — see implementation note 1. `integration.test.ts` › `should move a roll input when the skills it names change (Req 5.4)` proves the chain end to end through the real stores; `InventoryPanel.test.tsx` › `should carry the equipment bonus through to stats and roll inputs` proves equipping moves it.)
- [x] History records reshaped results; the settle animation path still works; RNG injected in tests. (`uiStore.test.ts`'s history fixture is the reshaped `RollOutcome`; `RollBreakdown` keeps `animate-roll-settle` and is still keyed on the roll's timestamp by `RollsSection`, so a repeat roll replays it. `useRoller` keeps the injectable `rng` option — no test spies on `Math.random`.)
- [ ] Grep criteria: `CombatSkill`, `DiceConfig`, and `skillCode` yield zero hits in `src/`; the bridge test from STAT-03 is deleted with the bridge. — **Partly met, and the shortfall is deliberate; see implementation note 6.**
- [x] Components compose `ui/` primitives, theme tokens only. (`RollsSection` and `RollBreakdown` compose `Card`/`Text`/`Button`/`ErrorChip`; no raw element, no hex, no stock Tailwind palette.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (Recorded below.)
- [ ] Verified live in the browser: raise a stat, watch the pool change, roll, check breakdown and history — the settle animation is the part only a browser confirms. — **left open: the User declined the live check for this run and the rest of the milestone.**

## Notes

- This closes the triad collapse: stats (STAT-01), skills (SKL-02), rolls (here). After it lands,
  nothing of the v1 core model remains.
- APT near the roll buttons is sheet composition (it's a derived stat since STAT-01), not a new
  concept — note for a polish pass if the User wants it.

### What the two review passes changed

The `verifier` and the `conventions-reviewer` each caught a real gap, and both were the same gap
seen from different angles — **the first pass deleted tests for behaviour that still exists in
renamed form**, which is exactly the failure TICKET-SKL-02 recorded.

- The **verifier** noticed `rollCalculator.ts`, `rollDefinition.ts` and `useRoller.ts` had no direct
  coverage, having inherited it from three suites this ticket deleted. Those three files now exist.
- The **conventions-reviewer** then noticed that *nothing rendered a `RollOutcome`* — the reshaped
  `RollBreakdown` and `RollHistoryPanel` plus the new `RollsSection` were asserted by no test, and
  no test clicked a Roll button anywhere. `RollsSection.test.tsx` closes that.
- It also found the one piece of the old model still alive **as code** rather than as a comment:
  `'combat-skill'` was still a `FormulaOwner` with three table rows, reachable only from tests.
  Removed, and the tests that exercised the dead row repointed at `roll-input`, which is what they
  now mean.
- And it asked for `rollPool` to be extracted: the ladder lookup and notation were written twice,
  in `useCharacterSheet` and `rollDefinition`, agreeing only by inspection. One exported helper now
  makes implementation note 1's claim literally true.
- Four smaller findings landed with them: the export round-trip had lost its second formula field
  (`validConfig` carries a roll again), `resolveSkillId` was dead once the combat manager went,
  the data-model skill and `docs/imports/README.md` were stale on the shape this ticket changed,
  and two formatting nits.
