# TICKET-ROLL-02 — Combat skill roller on the character sheet

- **Area:** Rolls
- **Type:** Feature
- **Traceability:** Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 5.5, 5.6, 21.1-21.5, 22.1-22.6
- **Replaces plan items:** tasks.md §12.5

## User story

As a Player, I want to roll a combat skill from my character sheet and see how the result was made
up, so that I can resolve a combat action without picking up physical dice.

## Description

The dice engine and the session roll history both exist and neither has a caller. This ticket adds
the roll button to each combat skill on the character sheet, the result breakdown it produces, and
the session history beside it.

## Current situation (as-is)

- [`rollCombatSkill(skill, calculatedCharacter, config, rng?, timestamp?)`](../../../src/engine/dice/combatRoll.ts)
  already returns the whole breakdown — per-die-type rolls, `diceTotal`, `bonus`, `total`,
  `timestamp` — taking its bonus from `calculateCombatSkillBonuses` so a roll can never disagree
  with the sheet ([TICKET-ROLL-01](./TICKET-ROLL-01-dice-rolling-engine.md)). **It has no caller
  outside its own test.**
- [`useUIStore`](../../../src/stores/uiStore.ts) already has `rollHistory`, `addRollResult(result)`,
  `clearRollHistory()` and `getRollHistory(characterId?)`, with `RollResult extends
  CombatRollResult` adding `id`, `characterId` and `characterName`. **None of the four has a caller
  either.** History is session-only and deliberately not persisted.
- [`CombatSkillsSection`](../../../src/components/play/sheet/CombatSkillsSection.tsx) renders each
  combat skill's name, dice notation and bonus, and says in its own JSDoc that the roll control
  mounts here — [TICKET-CHAR-03](./TICKET-CHAR-03-character-sheet.md) shipped the section
  deliberately without it.
- `useCharacterSheet` computes the `CalculatedCharacter` once per render but currently returns only
  the per-section breakdowns; the roller needs the `CalculatedCharacter` itself, since that is what
  `rollCombatSkill` takes.
- There are **no keyframes and no animation utilities** in
  [`styles.css`](../../../src/styles.css) — the "animated dice" of plan §12.5 has nothing to build
  on yet.

## Desired result (to-be)

- Each combat skill on the sheet carries a roll button (Req 15.1). Rolling calls `rollCombatSkill`
  once — no dice logic and no formula evaluation in the component (Req 15.2, 15.3).
- The result shows the individual die results (grouped by die type, in `DIE_TYPES` order), the dice
  total, the bonus, and the combined total (Req 15.4).
- Every roll is appended to the session history in `useUIStore`, shown newest-first for the
  character being viewed, with a way to clear it (Req 15.5).
- The result animates in briefly on each new roll, using a CSS keyframe added to the theme — no
  animation library and no JS timer.
- A ruleset whose combat formula does not evaluate surfaces the message instead of crashing the
  sheet.

## Acceptance criteria

- [x] Every combat skill on the sheet has its own roll control (Req 15.1). ([`CombatSkillsSection.tsx`](../../../src/components/play/sheet/CombatSkillsSection.tsx) now renders a `Roll <CODE>` button per skill, disabled while `canRoll` is false. Test *"should offer a roll control for every combat skill"* — both `Roll MEL` and `Roll RNG`.)
- [x] Rolling produces a result through `rollCombatSkill()` — the component simulates no dice and
      evaluates no formula itself (Req 15.2, 15.3), proven by a test that injects a deterministic
      `RandomSource` and asserts the exact numbers. ([`useCombatRoller.ts`](../../../src/components/play/rolls/useCombatRoller.ts) calls the engine and stores the result; nothing else touches dice or formulas. Test *"should roll every configured die and add the engine bonus"* injects `sequenceRng([0, 0.99])` and asserts the full result: `d6` rolls `[1, 6]`, `diceTotal 7`, `bonus 5`, `total 12`.)
- [x] The result displays individual die results, the dice total, the bonus and the combined total
      (Req 15.4). ([`RollBreakdown.tsx`](../../../src/components/play/rolls/RollBreakdown.tsx) renders one line per die type with its individual rolls, then dice total, bonus and total. Test *"should show the dice, bonus and total of the last roll"* reads them out of the rendered sheet and asserts `total === dice + bonus` with the dice inside `2..12` for 2d6 — an invariant that holds under real randomness.)
- [x] The roll's bonus equals the bonus the sheet displays for that skill — asserted in a test, not
      just by construction. (Two ways: *"should take its bonus from the same calculator the sheet displays"* compares against `calculateCharacter(...).combatSkillBonuses.RNG` directly, and *"should roll the bonus the sheet displays for that skill"* asserts the Ranged row shows `+10` **and** the roll shows `bonus +10`.)
- [x] Each roll is added to `useUIStore.rollHistory` through the store action, and the history
      renders newest-first for the current character only (Req 15.5). ([`RollHistoryPanel.tsx`](../../../src/components/play/rolls/RollHistoryPanel.tsx); the hook calls `addRollResult`, which already prepends. Tests *"should record every roll in the session history, newest first"* (`['RNG', 'MEL']` after rolling MEL then RNG, tagged with the character's id and name), *"should show only the current character rolls"* (a second character's hook sees none of them), and at sheet level *"should grow the roll history and clear it again"*.)
- [x] The history can be cleared, and clearing goes through `clearRollHistory()`. (`handleClearHistory` is the store action itself. Tests *"should clear the history through the store action"* (store state emptied) and the sheet-level clear, which returns the panel to its "No rolls this session" state.)
- [x] Roll history is session-only — nothing about a roll is written to `localStorage` or onto the
      `Character`. (History lives in `useUIStore`, which has no storage calls; `storage.ts` was not touched. Test *"should keep roll history out of storage and off the character"* asserts one roll in the UI store and that the persisted character's JSON contains no roll data.)
- [ ] ~~A combat skill whose bonus formula does not evaluate shows the error instead of crashing the
      sheet.~~ **Amended during implementation (2026-08-01):** unreachable as written.
      `calculateCombatSkillBonuses` runs inside `calculateCharacter`, so a broken combat formula
      puts the *whole sheet* into the existing `formula-error` state before any roll button is
      rendered — TICKET-CHAR-03 already covers that. The roller keeps a guard because
      `rollCombatSkill` is documented `@throws` and the hook accepts its `CalculatedCharacter` from
      the caller, so the two can disagree. Restated: **a roll whose bonus formula does not evaluate
      is reported against that skill and does not throw out of the hook**, tested at the hook level
      where the case is actually reachable. — [x] **restated criterion met**: test *"should report a
      bonus formula that does not evaluate instead of throwing"* gives the hook a validly-calculated
      character and a broken loaded ruleset; `errors.MEL` names the skill, no result is stored, and
      the history stays empty. *"should refuse to roll without a calculated character"* covers the
      other guard.
- [x] The result animates on each new roll via a keyframe defined in `styles.css`; no new runtime
      dependency and no `setTimeout`. (`@keyframes roll-settle` + `.animate-roll-settle` in [`styles.css`](../../../src/styles.css); `RollBreakdown` carries the class and the section keys it on `result.timestamp`, so a repeat roll remounts and replays it. `package.json` is unchanged, and `grep -rn "setTimeout" src/components/play/` finds nothing. The keyframe is disabled under `prefers-reduced-motion` (Req 22.6).)
- [x] The roller composes `components/ui` primitives and owns its layout; no raw HTML controls, no
      base component gains layout styling (Req 21.1-21.5), medieval theme tokens only
      (Req 22.1-22.6). (`Card`, `Text`, `Button` throughout; `grep -n "<\(button\|input\|select\|textarea\)\b" src/components/play/rolls/*.tsx` returns nothing. No `components/ui/` file was touched. Colour and type come from the primitives' variants; the only raw class is `border-stone-200`.)
- [x] Unit tests cover: a roll button per combat skill; deterministic roll numbers with an injected
      RNG; breakdown shows dice, bonus and total; the roll's bonus matches the sheet's; history
      grows and is newest-first; history is filtered to the current character; clearing empties it;
      a broken formula is reported. (+12 tests in `CombatRoller.test.tsx` — 7 hook-level with `renderHook`, 5 through the rendered sheet. Suite: **599 passing, 0 failing, 0 skipped** (was 587).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"` with 0 introduced findings of every kind, first pass, nothing to fix. `npx tsc --noEmit` at the documented 9 errors; `yarn run lint` at the documented 35 errors / 23 warnings.)
- [ ] Verified live in the browser: roll a combat skill several times, watch the breakdown and the
      history update, then clear it. — **left open at the User's request** (2026-08-01: "don't
      browser check"). The roll → breakdown → history → clear cycle is covered by the sheet-level
      tests; **the settle animation is the one thing only a browser can confirm.**

## Notes

- **Randomness must stay injectable.** `rollCombatSkill` takes a `RandomSource` defaulting to
  `Math.random`; production passes nothing and the tests pass a deterministic sequence. Do not
  reach for `vi.spyOn(Math, 'random')` — the seam already exists.
- `RollResult.id` needs a unique value per roll; `crypto.randomUUID()` is what
  `createCharacterFromData` already uses.
- The history lives in `useUIStore` and is **not** persisted, matching the store's existing split
  between session UI state and the persisted stores. Do not add it to `storage.ts`.
- `rollCombatSkill` throws when a bonus formula cannot be evaluated (Req 16.6). The sheet already
  has a formula-error state for the *stat* case, but a combat formula only fails at roll time —
  catch it at the roll site and show it beside the skill rather than blanking the whole sheet.
