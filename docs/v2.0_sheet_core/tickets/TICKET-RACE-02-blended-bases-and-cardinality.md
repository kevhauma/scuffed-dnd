# TICKET-RACE-02 — Blended bases and race cardinality

- **Area:** Races configuration
- **Type:** Feature + Bug fix (replaces additive stacking with the sheet's blend)
- **Traceability:** Concept [04 · Creature](../../excel%20export%20summary/concepts/04-creature.md) (hybrid blend); Concept [05 · Constant](../../excel%20export%20summary/concepts/05-constant.md) (`race_blend_divisor`)

## User story

As a Player, I want my base stats to come from my race — or the round-up average of my two races —
so that race math matches the sheet, where picking the same race twice changes nothing.

## Description

The app sums racial modifiers additively across an unbounded race list (same race twice doubles
it); the sheet blends exactly 1–2 races as `roundup((a + b) / 2)`. This ticket wires RACE-01's
stat blocks into the composition and enforces the cardinality.

## Current situation (as-is)

- [`calculateRacialSkillModifiers`](../../../src/engine/calculators/mainSkillCalculator.ts)
  documents "Multiple races combine additively"; `Character.raceIds: string[]` has no length
  limit in the wizard or the store.
- STAT-01's composition carries `race base = 0` awaiting this ticket.

## Desired result (to-be)

- **Base term:** one race → its `statValues`; two races → `roundup((a + b) /
  const.race_blend_divisor)` (seeded divisor 2), computed in the calculator — same race twice
  degenerates to itself.
- **Cardinality 1–2 enforced** in the store action (a third race refused as data validation) and
  in the wizard's race step.
- The sheet's racial section renders the base contribution per stat from the calculator's
  breakdown, replacing the modifier list.

## Acceptance criteria

- [x] Blend pinned: single race, even sum, odd sum (`(9 + 12) / 2 → 11`), same-race identity; divisor read from the constant (changing it changes the blend — test). (`statCalculator.test.ts` → `calculateRaceStatBases — the hybrid blend (TICKET-RACE-02)`, eight cases: single-race identity, no races, even/odd average, an absent entry counting as a real 0, same-race identity, negative rounding away from zero, divisor 1 and 4 from the constant, and a third race ignored. **Divisor caveat:** it only applies to the two-race path — a single race returns its own block untouched, deliberately, so that stays true for a retuned divisor rather than halving a lone race.)
- [x] Store action and wizard both refuse a third race (tests for each). (`characterStore.test.ts` → `should refuse a third race, storing nothing` — `createCharacter` returns `null`, nothing reaches storage — plus `should refuse a patch that would give a character a third race` and `should accept none, one or two races`. Wizard: `CharacterCreationWizard.test.tsx` → `should refuse a third race and say why` — the third `Checkbox` is `disabled`, clicking it leaves it unchecked, and clearing one puts it back in reach.)
- [x] Sheet renders base contributions from the breakdown; no component computes blends. (`useCharacterSheet.ts:194` calls `calculateRaceStatBases(races, config.constants)` — the same engine function the composition calls — and feeds both `raceContributions` and each stat's `race` term from it; `RaceStatBlockSection.tsx` only maps over what it is handed. Pinned by `CharacterSheet.test.tsx` → `should blend race stat blocks across two races`: `DEX 2` from blocks of 2 and 1, `race +2` in the breakdown row, and the `Elf × Human — blended` subtitle.)
- [x] Composition integration through `calculateCharacter`: race base + invested + equipment sum correctly per stat. (`calculator.test.ts` → `should sum the blended base, the invested points and equipment per stat` and `should blend two races into the base and keep the terms separable`; `integration.test.ts` → `should blend two races through the whole chain rather than stacking them`, which also shows the blend carrying into a speciality skill that reads the stat.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`npx vitest run` 1252 passing / 0 failing / 0 skipped; `npx tsc --noEmit` at the documented 2-error baseline; `yarn run check` clean. `fallow audit --base HEAD`: verdict **pass**, 0 introduced dead code, 0 complexity findings, 0 clone groups. `conventions-reviewer` on the diff: layering, store-owned persistence, engine-owned math, base-vs-feature split and theme tokens all clean; its four actionable findings are folded in — see implementation notes 2, 3 and 5.)
- [ ] Verified live in the browser: a two-race character shows blended bases. — **left open**: the User asked for the browser check to be skipped on this run.

## Implementation notes

1. **Cardinality is an upper bound only.** The to-be says "1–2 enforced"; what shipped refuses the
   *third* race and leaves zero legal. A ruleset may define no races at all, and a raceless
   character is a coherent state the sheet already has an empty state for (Requirement 11.2) —
   requiring one would make the wizard unusable on a ruleset that has none. `hasBlendableRaces` in
   [characterStore.ts](../../../src/stores/characterStore.ts) says so in its own doc comment.
2. **`roundup` is Excel's, not `Math.ceil`.** The blend rounds *away from zero*, so a negative
   average agrees with a User formula that spells `roundup`. `roundAwayFromZero` is now exported
   from [functions.ts](../../../src/engine/formula/functions.ts) and is the single definition the
   function library and the calculator share.
3. **The divisor is the first constant the engine reads by name.** The blend is system arithmetic,
   not User-authored math, so there is no formula for `references.ts` to re-spell — which means
   renaming `race_blend_divisor` makes the engine stop finding it and fall back to the seeded 2. It
   resolves through `constantsNamespace` rather than a second `find`, so a duplicate name means the
   same constant here as in every formula, and a zero/negative/non-finite value falls back too
   (TICKET-FORM-07's no-`NaN`/`Infinity` rule applied outside the evaluator). If the ruleset ever
   needs the divisor to survive a rename, that is a `references.ts` scope of its own.
4. **`createCharacter` is nullable now** — `Character | null`, the first thing the character store
   refuses outright. One production call site (`useCharacterCreation.handleConfirm`) handles it by
   staying put; `identityStepError` mirrors the same rule at the step that owns the choice, so the
   two limits drifting apart would show the Player a message rather than a Submit that does nothing.
5. **A third race in existing data is ignored, not migrated.** `calculateRaceStatBases` blends the
   first two and documents it; `updateCharacter` only refuses a patch that *carries* `raceIds`, so
   such a character stays editable. No `SUPPORTED_SCHEMA_VERSION` bump: `schemaVersion` lives on
   `Configuration` and no persisted shape changed — only how `raceIds` is read.
6. **Sheet-import fragment**: [races.json](../../imports/races.json) carries the change forward in
   `notes` (the blocks themselves are unchanged — the blend is how they are *read*), and
   `yarn run sheet:import` was rerun. The merge does not copy fragment `notes` into
   `ducklets.json`, so that file is byte-identical; `src/services/sheetImport.test.ts` passes.
7. **Left open, from RACE-01's note 5**: whether a *derived* stat should get a row in the race
   block editor at all. `RaceFormDialog` still renders every stat. Untouched here — it is an editor
   question, not a composition one — and it should move to a later races ticket.

## Notes

- The concept page writes the blend as `roundup(race_a.stat + race_b.stat) / 2`; the worked
  samples show the intent is round-up of the average. The composition eventually becoming
  editable formula-data (spec) is deferred; calculator code reading the constant is the honest
  v2.0 scope.
