# TICKET-CHAR-03 — Character sheet at `/play/character/$id`

- **Area:** Characters
- **Type:** Feature
- **Traceability:** Requirements 8.5, 13.4, 14.1, 14.2, 14.3, 14.4, 14.5, 9.3, 11.5, 21.1-21.5, 22.1-22.6
- **Replaces plan items:** tasks.md §12.3, §12.6

## User story

As a Player, I want a character sheet that shows every skill, stat and bonus my character has and
lets me track current stat values while I play, so that I can run a session from one screen instead
of recalculating numbers by hand.

## Description

Creating a character already works, but the destination it navigates to is a placeholder. This
ticket builds the sheet itself — header, racial modifiers, main skills, stats with editable current
values, speciality skills and combat skills — reading every derived number from
`calculateCharacter()` and persisting current stat changes through the character store.

## Current situation (as-is)

- [`src/routes/play/character.$id.tsx`](../../../src/routes/play/character.$id.tsx) renders a
  stock-palette placeholder (`text-3xl font-bold`, `text-gray-600`) that prints the raw id. It is
  the target of
  [`useCharacterListManager.handleOpen`](../../../src/components/play/characters/useCharacterListManager.ts)
  and of the creation wizard's confirm step, so both existing play screens lead to a dead end.
- [`calculateCharacter(character, config)`](../../../src/engine/calculator.ts) already returns the
  full `CalculatedCharacter` — `totalMainSkillLevels`, `maxStatValues`,
  `specialitySkillTotalLevels`, `combatSkillBonuses`, `equipmentBonuses` — from
  [TICKET-CALC-01](./TICKET-CALC-01-calculated-character-assembly.md). Nothing on a sheet needs to
  do arithmetic.
- [`calculateRacialSkillModifiers`](../../../src/engine/calculators/mainSkillCalculator.ts) already
  produces the per-skill racial total that Requirement 8.5 asks the sheet to display; the creation
  wizard's skill step is the only caller today.
- [`useCharacterStore`](../../../src/stores/characterStore.ts) has
  `updateCurrentStatValue(characterId, statId, value)` and `updateCurrentStatValues(...)`, both
  persisting via `autoSave`. **Neither has a caller**, and neither clamps: any number, above max or
  below zero, is written straight through. Requirement 14.3's cap therefore has nowhere to live yet.
- `createCharacter` seeds `currentStatValues` to the calculated maxima
  ([TICKET-CHAR-02](./TICKET-CHAR-02-character-creation-wizard.md)), so a fresh character already
  has values to display — but a character whose configuration changed afterwards can hold a current
  value above its new maximum.
- The shape to follow is the list screen: a presentational component under
  `src/components/play/…` composing `components/ui` primitives, with the decisions in a
  `useXManager` hook — see
  [`CharacterList.tsx`](../../../src/components/play/characters/CharacterList.tsx) and
  [`useCharacterListManager.ts`](../../../src/components/play/characters/useCharacterListManager.ts).

## Desired result (to-be)

- `/play/character/$id` mounts a `CharacterSheet` from `src/components/play/sheet/`, with all state
  and handlers in a `useCharacterSheet(id)` hook and the sections presentational.
- The sheet shows, in order:
  1. **Header** — name, race names, character level, and a way back to `/play`.
  2. **Racial modifiers** — the combined per-skill modifier from every selected race, additive
     across multiple races (Req 8.5, 8.3, 8.4).
  3. **Main skills** — for each: allocated level, racial modifier, equipment bonus and total, with
     the contributions shown separately rather than only as a sum (Req 13.4).
  4. **Stats** — a `StatEditor` per stat showing current **and** maximum value with controls to
     change the current value (Req 14.1, 14.2).
  5. **Speciality skills** — base level and total, equipment bonus shown separately (Req 13.4).
  6. **Combat skills** — name, dice notation and calculated bonus for each configured combat skill.
- `StatEditor` edits are clamped to the maximum and allow negatives (Req 14.3, 14.4) and persist
  through `useCharacterStore.updateCurrentStatValue` (Req 14.5). **The clamp lives in the store
  action**, not only in the component, so an out-of-range value cannot be written by any caller.
- The focus stat is identified on the sheet where it applies (Req 9.3) — the skill it was spent on
  is marked, and the bonus is visible as part of that skill's breakdown.
- Degenerate states each render an explanation and no sheet: no configuration loaded, no character
  with that id, a character whose `configurationId` does not match the loaded configuration, and a
  configuration whose formulas throw (`calculateCharacter` errors — surface the message).
- Medieval theme tokens only; the placeholder's stock palette goes away.

## Acceptance criteria

- [x] `/play/character/$id` renders a real sheet for a saved character, reachable from the character
      list and from the creation wizard's confirm step. ([`character.$id.tsx`](../../../src/routes/play/character.$id.tsx) mounts `CharacterSheet` with the route param; both existing entry points already navigate to `/play/character/$id`. Test *"should render the character sheet for the route param"* in `playRoutes.test.tsx` asserts the param reaches the component, and *"should no longer render the scaffold placeholder copy"* asserts the placeholder is gone.)
- [x] The header shows the character's name, every race name, and the character level. ([`SheetHeader.tsx`](../../../src/components/play/sheet/SheetHeader.tsx). Test *"should render the header, every section, and the character identity"* — `Aria` as the `h1` and `Level 10 · Elf · focus: STL`. Level comes from `calculateCharacterLevel`, the one definition.)
- [x] Total racial modifiers are displayed per skill and combine additively across multiple races
      (Req 8.5) — covered by a test with a two-race character. ([`RacialModifiersSection.tsx`](../../../src/components/play/sheet/RacialModifiersSection.tsx). Test *"should combine racial modifiers additively across multiple races"* — Elf `DEX +2` plus Human `DEX +1` renders as `DEX +3`, and the same `+3` appears in the Dexterity row.)
- [x] Main skills show allocated level, racial modifier, equipment bonus and total as separate
      figures (Req 13.4), and speciality skills show base and total with the equipment bonus
      separate. ([`SkillBreakdownRow.tsx`](../../../src/components/play/sheet/SkillBreakdownRow.tsx) renders each contribution as its own labelled element; [`MainSkillsSection`](../../../src/components/play/sheet/MainSkillsSection.tsx) passes allocated/racial/equipment/focus, [`SpecialitySkillsSection`](../../../src/components/play/sheet/SpecialitySkillsSection.tsx) passes base/equipment/focus. Test *"should show a main skill's contributions separately from its total"* — `allocated +4`, `racial +2` and the total `6` are three separate elements in the row. Zero-valued contributions are dropped, except the allocated/base level which always shows.)
- [x] Every displayed derived number comes from `calculateCharacter()` /
      `calculateRacialSkillModifiers()`; the sheet re-implements no arithmetic — a test compares the
      rendered values against an independent engine call for the same fixture. (`buildView` in [`useCharacterSheet.ts`](../../../src/components/play/sheet/useCharacterSheet.ts) only indexes engine output; the section components hold no arithmetic. Test *"should render values that match calculateCharacter for the same character"* calls `calculateCharacter` independently and asserts the rendered main-skill totals, speciality total, combat bonus and stat maximum each equal the engine's number.)
- [x] Each stat renders both its current and maximum value (Req 14.1) with a control that changes
      the current value (Req 14.2). ([`StatEditor.tsx`](../../../src/components/play/sheet/StatEditor.tsx) — a number `Input` for the current value, `of {max} max` beside it, plus −/+ step buttons. Tests *"should show both current and maximum values for every stat"* (Health input `60`, `of 60 max`; Mana `30`, `of 30 max`), *"should persist a changed current stat value through the store"*, and *"should step a stat down with the decrease control"* (60 → 59).)
- [x] A current stat value cannot exceed its maximum (Req 14.3) and negative values are accepted
      (Req 14.4), with the clamp enforced in the store action so no caller can bypass it. (`clampToMaxStatValues` in [`characterStore.ts`](../../../src/stores/characterStore.ts) — a one-sided `Math.min` against `calculateCharacter().maxStatValues`, applied inside `updateCurrentStatValues`, which `updateCurrentStatValue` now delegates to. Both actions take the `Configuration` as their last argument, so the maxima cannot be skipped. Store tests *"should clamp a value above the calculated maximum"* (999 → 100), *"should allow negative values"* (−10 stored), *"should clamp each value independently"* (health 500 → 100 while mana −5 passes). Sheet tests *"should clamp a current stat value at its maximum"* and *"should allow a negative current stat value"* prove it end-to-end through the UI.)
- [x] Current stat changes persist through `useCharacterStore` only — the sheet, the hook and
      `StatEditor` never call `saveCharacters()` or `localStorage` (Req 14.5). (`handleChangeStatValue` calls `updateCurrentStatValue`; `grep -rn "localStorage\|saveCharacters" src/components/play/sheet/` returns nothing. The sheet tests use the real stores with only the storage service mocked, so an edit really round-trips through the action.)
- [x] Combat skills are listed with their name, dice notation and calculated bonus. ([`CombatSkillsSection.tsx`](../../../src/components/play/sheet/CombatSkillsSection.tsx). Notation comes from the new `formatDiceNotation` in [`diceSimulator.ts`](../../../src/engine/dice/diceSimulator.ts), shared with the roller so both read the same string. Test *"should list each combat skill with its dice notation and bonus"* — `2d6 + 1d20` for a `{d6: 2, d20: 1}` config, plus engine-matched bonus in the values test.)
- [x] The focus stat is identified on the skill it applies to (Req 9.3). (Test *"should mark the focus stat and show the bonus it grants"* — the Stealth row carries both a `focus stat` marker and a `focus +3` contribution, from the configuration's `focusStatBonusLevel`.)
- [x] No configuration, unknown character id, configuration mismatch, and a formula-evaluation
      failure each render an explanatory state instead of a broken or empty sheet. (`resolveStatus` in the hook plus the four `SheetNotice` branches in [`CharacterSheet.tsx`](../../../src/components/play/sheet/CharacterSheet.tsx). Four tests under *"states without a sheet"* assert the right heading — `No Ruleset Yet`, `Character Not Found`, `Different Ruleset Loaded`, `Ruleset Formula Error` — **and** that the `Main Skills` section is absent in each, so a partial sheet cannot pass.)
- [x] The sheet and its sections compose `components/ui` primitives (`Card`, `Text`, `Button`,
      `Input`, `Label`); no raw HTML controls, and no base component gains layout styling
      (Req 21.1-21.5). (`grep -n "<\(button\|input\|select\|textarea\)\b" src/components/play/sheet/*.tsx` returns nothing; only `div`/`span` wrappers carry layout. No file under `src/components/ui/` was touched by this ticket, and `libraryConventions.test.ts` still passes.)
- [x] Only medieval theme tokens are used — the placeholder's `text-gray-600` and friends are gone
      (Req 22.1-22.6). (Classes across the eight new files are layout utilities plus `border-stone-200`; all colour and typography comes from `Text`/`Card`/`Button`/`Input` variants. Route test *"should carry no stock Tailwind palette classes"* now covers `character.$id.tsx` as well.)
- [x] Unit tests cover: sheet renders a character's sections; racial modifiers combine across two
      races; rendered totals match `calculateCharacter()`; current value clamped at max; negative
      current value accepted; a stat edit calls the store action once and persists; unknown id,
      missing configuration, mismatched configuration and formula-error states; store-level clamp
      tested directly in `characterStore.test.ts`. (+28 tests: `CharacterSheet.test.tsx` (16), 3 in `playRoutes.test.tsx`, 4 in `characterStore.test.ts`, 2 in `diceSimulator.test.ts`, 3 in `equipmentBonusCalculator.test.ts`. Suite: **571 passing, 0 failing, 0 skipped** (was 543).)
- [x] Verified via the fallow skill and the coding-conventions skill. (`fallow audit --base HEAD` → `"verdict": "pass"`, `dead_code_introduced: 0`, `complexity_introduced: 0`, `duplication_introduced: 0`. Two introduced findings were fixed rather than suppressed: `CharacterSheetStatus` was exported but imported nowhere (made module-private), and `useCharacterSheet` hit 21 cyclomatic / 24 cognitive (the status ladder became `resolveStatus` and the five breakdown maps became `buildView`, both module-level pure functions). Biome's `useUniqueElementIds` fired 16 times on `<CharacterSheet id="…">` in tests; fixed at the source by renaming the prop to `characterId` — a domain id, not a DOM one — rather than suppressing. `yarn run lint` is back to the documented 35 errors / 23 warnings and `npx tsc --noEmit` to the documented 9.)
- [ ] Verified live in the browser: open a created character, change a current stat value, confirm
      it clamps at max, accepts a negative, and survives a reload. — **left open at the User's
      request** (2026-08-01: "don't browser check"). Everything above is covered by the automated
      suite; this box stays open until someone runs the scenario.

## Notes

- **Roll buttons are deliberately out of scope.** Plan §12.3 lists "combat skills with roll
  buttons", but the roller — animated dice, result breakdown, session history — is its own line
  (plan §12.5, Req 15.1-15.5) built on
  [TICKET-ROLL-01](./TICKET-ROLL-01-dice-rolling-engine.md). This ticket builds the combat-skill
  section that displays each skill's bonus; the roll control mounts into that section when §12.5 is
  ticketed. Splitting here keeps the sheet shippable and stops one ticket from owning two screens'
  worth of behaviour.
- **The inventory panel is also out of scope** (plan §12.4, Req 12.1-12.6). Equipment bonuses are
  *displayed* here because `calculateCharacter()` already returns them and Req 13.4 asks the sheet
  to break them out; equipping and unequipping arrive with the inventory ticket, which hangs off
  this sheet.
- Clamping in the store changes `updateCurrentStatValue`'s contract: it needs the maximum, so it
  either takes the `Configuration` (as `createCharacter` already does since CHAR-02) or clamps
  against a max passed by the caller. Prefer passing the `Configuration` for consistency with
  `createCharacter` and so the store, not the component, owns the rule.
- Requirement 14.3 has no stated behaviour for a character whose stored current value already
  exceeds a maximum that shrank after a configuration edit. Display the stored value and clamp on
  the next edit rather than silently rewriting persisted data on render — a render must not
  persist.
- `StatEditor` is plan §12.6 and is built inside this ticket rather than as a follow-up, per the
  overview's "embedded in the sheet, build alongside it" note.
