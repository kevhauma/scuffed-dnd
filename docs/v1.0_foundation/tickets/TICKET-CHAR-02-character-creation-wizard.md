# TICKET-CHAR-02 — Character creation wizard at `/play/create`

- **Area:** Characters
- **Type:** Feature
- **Traceability:** Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 21.1-21.5
- **Replaces plan items:** tasks.md §12.2

## User story

As a Player, I want to build a character step by step against the User's ruleset, so that I end up
with a valid character whose derived values are already calculated for me.

## Description

Nothing in the app can create a character yet — `useCharacterStore.createCharacter()` exists but
has no caller. This ticket builds the four-step wizard that gathers a name and races, allocates
main-skill points within the configured rules, picks a focus stat, and confirms — then creates the
character with an inventory initialised from the configured equipment slots.

## Current situation (as-is)

- [`src/routes/play/create.tsx`](../../../src/routes/play/create.tsx) is a placeholder route
  component.
- [`useCharacterStore.createCharacter(data, configId)`](../../../src/stores/characterStore.ts)
  already accepts a
  [`CharacterCreationData`](../../../src/types/character.ts) (`name`, `raceIds`,
  `mainSkillLevels`, `focusStatCode?`, `specialitySkillBaseLevels`), persists, and returns the new
  `Character` — it has no caller anywhere.
- Everything the wizard reads is on the configuration: `mainSkills` (with `maxLevel`), `races`
  (with `skillModifiers`), `specialitySkills` (with `maxBaseLevel`), `equipmentSlots`, and
  `focusStatBonusLevel` — see [`config.ts`](../../../src/types/config.ts).
- Derived values are **not** fully solved:
  [`calculateCharacterStats()`](../../../src/engine/calculator.ts) returns max stat values only
  (`Record<statId, number>`), and nothing produces the declared `CalculatedCharacter`. The review
  step needs speciality totals and combat bonuses too, which is
  [TICKET-CALC-01](./TICKET-CALC-01-calculated-character-assembly.md) — build that first and
  consume it here; do not compose the calculators inline in the wizard.
- The multi-step form pattern does not exist yet in this codebase; the closest reference is the
  form-dialog + `useXManager` + `react-hook-form` shape used by the config panels, e.g.
  [`useRaceManager`](../../../src/components/config/races/useRaceManager.ts).
- ~~**Point-allocation rules are underspecified.**~~ **Resolved by
  [TICKET-SKL-01](./TICKET-SKL-01-main-skill-point-allocation-rules.md) (landed 2026-08-01):**
  `Configuration.mainSkillPointBudget?: number` is a single global pool, one point per level, and
  `validateMainSkillAllocation(levels, config)` in `src/engine/skillAllocation.ts` returns points
  spent, points remaining, per-skill violations and the verdict. **Step 2 must call it** — do not
  re-sum levels in the wizard. An absent budget means unlimited.

## Desired result (to-be)

- `/play/create` renders a four-step wizard under `src/components/play/creation/`:
  1. **Identity** — name (required, non-empty) and race multi-select (zero or more, Req 11.2).
  2. **Main skills** — a level allocator per main skill, bounded by each skill's `maxLevel`, showing
     the racial modifier from the selected races separately from the allocated base level.
  3. **Focus stat** — pick one main or speciality skill; the configured `focusStatBonusLevel` is
     shown as the bonus it will grant (Req 11.4).
  4. **Review** — the full derived preview from TICKET-CALC-01's `calculateCharacter()`: total
     main skills, max stat values, speciality totals, combat bonuses (Req 11.5). Confirm creates
     the character.
- Back/next navigation preserves entered data; a step with invalid input blocks "next" and says why.
- Creating calls `useCharacterStore.createCharacter()` once, with an empty inventory (Req 11.6 —
  `Inventory.equippedItems` is a slot→item map, so "initialised with the configured slots" means
  the UI reads slots from the configuration, not that empty entries are written onto the
  character), then navigates to the new character's sheet.
- Wizard state lives in a `useCharacterCreation` hook (step index, form state via
  `react-hook-form`, validation, submit); the step components are presentational.
- With no configuration loaded, the route explains that a ruleset is required and offers a link to
  configuration mode instead of a broken form.

## Acceptance criteria

- [x] The wizard has four navigable steps; moving back and forward preserves every value already entered. (`CREATION_STEPS = ['Identity', 'Skills', 'Focus', 'Review']` with a single `react-hook-form` instance spanning all four, so nothing is remounted away. Test *"should preserve entered values when moving back and forward"* — the name survives a trip forward and back, and an allocated level survives the return trip.)
- [x] Step 1 requires a non-empty name and allows selecting zero or more races (Req 11.1, 11.2). (Tests *"should block step 1 until a name is entered, saying why"* (Next is disabled and the reason is shown, then both clear on typing) and *"should allow selecting zero or more races"* (zero races leaves Next enabled; two can be checked together). A whitespace-only name is treated as empty — the hook trims before checking.)
- [x] Step 2 allocates a level per main skill, never above that skill's `maxLevel`, and displays racial modifiers separately from the allocated base level (Req 11.3). (Tests *"should block progress when a skill exceeds its max level"* ("Strength cannot go above 10", Next disabled) and *"should show the racial modifier separately from the allocated base level"* — the input holds the allocated `3` while `+2 racial` and `total 5` render beside it, from `calculateRacialSkillModifiers`. Budget enforcement comes from `validateMainSkillAllocation`: tests *"should block progress when the allocation exceeds the point budget"* and *"should report points spent and remaining from the allocation validator"*. **This also closes TICKET-SKL-01's cross-check criterion** — the wizard re-sums nothing.)
- [x] Step 3 offers exactly one focus stat chosen from main **and** speciality skills, and states the bonus level it grants (Req 11.4). (Test *"should offer a focus stat from both main and speciality skills, stating the bonus"* asserts the option values contain `STR`, `DEX` **and** `STL`, and that "+3 levels" is shown. A single `Select` makes "exactly one" structural; a blank option keeps it optional.)
- [x] Step 4 shows derived stats, speciality totals, and combat bonuses read from TICKET-CALC-01's `calculateCharacter()` — no arithmetic is re-implemented in the wizard (Req 11.5). (`useCharacterCreation` builds a draft `Character` and calls `calculateCharacter`; `ReviewStep` only renders what it returns. Test *"should show review values that match calculateCharacter for the same data"* calls the engine independently with the same inputs and asserts each rendered row equals the engine's number.)
- [x] Confirming calls `createCharacter()` exactly once and navigates to `/play/character/$id` for the returned character. (Test *"should create the character once and navigate to its sheet"* — asserts exactly one character in the store afterwards, matching the assembled data, and the exact `navigate()` arguments using the returned id.)
- [x] The created character starts with an empty inventory — no equipped items, empty `miscItems` — and the slots it can fill are derived from the configuration's `equipmentSlots` rather than copied onto the character (Req 11.6). (Same test asserts `inventory` deep-equals `{ equippedItems: {}, miscItems: [] }`; the fixture configuration defines a `main_hand` slot and nothing about it is written onto the character. Browser: the created character stored `"inv":{"equippedItems":{},"miscItems":[]}`.)
- [x] Persistence happens only through the store action; the wizard never calls `saveCharacters()` or `localStorage`. (`useCharacterCreation.handleConfirm` calls `createCharacter` and navigates; `grep` finds no `localStorage`/`saveCharacters` in `src/components/` outside `vi.mock` declarations in test files.)
- [x] Invalid input blocks progression with a visible message rather than failing silently or on submit. (`stepError` is computed per step and both disables Next and renders as `Text variant="error"`. Covered by the name, max-level and over-budget tests. Browser: allocating 20/20 against a budget of 24 showed "That is 16 point(s) over the budget of 24." with Next disabled.)
- [x] With no configuration loaded, the route renders an explanatory state and no form. (Test *"should render an explanatory state and no form without a configuration"* — "No Ruleset Yet" renders, and both the name field and the Next button are asserted **absent**.)
- [x] Steps compose `components/ui` primitives (`Card`, `Input`, `Select`, `Button`, `Label`, `Text`); no raw HTML form controls, and base components gain no layout classes. (`FormField`, `Checkbox`, `Input`, `Select`, `Label`, `Card`, `Button`, `Text` throughout; no raw `<input>`/`<select>`/`<button>` in `src/components/play/`. Layout (`flex`, `gap-*`, `grid`, `w-24`, `max-w-4xl`) is passed in via `className` by the feature components; no base component was edited.)
- [x] Wizard state and handlers live in a `useCharacterCreation` hook, not in the step components. (The four step components take props only — no `useState`, no store imports, no engine calls. `CharacterCreationWizard` destructures the hook and dispatches on `stepIndex`.)
- [x] Unit tests cover: name validation blocks step 1; `maxLevel` cap enforced in step 2; racial modifier shown separately from base level; focus-stat options include both main and speciality skills; review values match `calculateCharacter()` for a fixture; confirm calls `createCharacter` with the assembled `CharacterCreationData`; no-configuration state. (+16 tests: `CharacterCreationWizard.test.tsx` (11), 3 added to `src/routes/play/playRoutes.test.tsx`, 2 added to `characterStore.test.ts`. Suite: 528 passing, 0 failing, 0 skipped. **The ticket's note about landing in the React 19 known-failing bucket is stale** — TICKET-DX-01 fixed that; these render and pass normally.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. It initially reported four: `CREATION_STEPS` and `CreationStep` exported but unused (the hook already exposes `steps`, so both were made module-private), `PlayCreate` exported without a test (three route tests added), and `stepError` at 10 cyclomatic / 12 cognitive (the allocation branch extracted into a module-level `allocationStepError`). One new lint error (`useUniqueElementIds` on the focus `Select`) was fixed with `useId()` rather than rebaselined; `yarn run lint` is back to the documented 35/23.)
- [x] Verified live in the browser: on `localhost:5173/play/create` with a ruleset loaded — step 1 blocked until "Lyra Duskwind" was typed, Elf selected; step 2 showed "0 of 24 points spent · 24 remaining" and `DEX max 20 · +2 racial · total 2`, refused 20/20 with "16 point(s) over the budget of 24" and Next disabled, then accepted STR 6 / DEX 4 / STL 3; step 3 listed `STR`, `DEX` **and** `STL` as focus options granting "+2 levels", and STL was chosen; step 4 showed STR 6, DEX 6 (4 allocated + 2 racial), Health 60, Stealth 14, Melee 20 — each matching the engine by hand. Confirming navigated to `/play/character/6d17321a-…` and persisted `mainSkillLevels {STR:6, DEX:4}` (the allocation, not the racial total), `focusStatCode "STL"`, an empty inventory, and `currentStatValues {health: 60}`. Reloading `/play` listed "Lyra Duskwind — Level 10 · Elf" alongside the existing character.

## Notes

- **The point budget shipped in
  [TICKET-SKL-01](./TICKET-SKL-01-main-skill-point-allocation-rules.md)** (2026-08-01), so this
  ticket is no longer blocked on it. Step 2 consumes `validateMainSkillAllocation` and renders
  `pointsSpent` / `pointsRemaining` / `violations`; it must not re-implement the arithmetic or
  invent a rule inline. SKL-01 left its own "CHAR-02 consumes the validator" criterion pointing
  here, so satisfying 11.3 in step 2 closes both.
- Multi-race bonuses combine additively (Req 8.3, 8.4) — that is already the calculator's job; the
  wizard only has to display them separately from allocated levels.
- ~~`createCharacterFromData()` already initialises `currentStatValues: {}`…~~ **Decided
  (2026-08-01): creation seeds `currentStatValues` to the calculated maxima**, so a new character
  starts at full health rather than at zero, which is what a Player expects. Done in the store
  action as the note directed, not in the wizard. This changed the action's signature from
  `createCharacter(data, configId: string)` to `createCharacter(data, config: Configuration)` —
  seeding needs the stat formulas, and `config.id` still supplies `configurationId`. A ruleset
  whose formulas do not evaluate falls back to `{}` rather than blocking creation.
- Speciality skill base levels are part of `CharacterCreationData`; if the configuration defines
  speciality skills, the wizard needs a place to set them — fold into step 2 alongside main skills
  rather than adding a fifth step.
- This is a hook-heavy component and will land in the documented React 19 + Vitest known-failing
  bucket ([TEST_STATUS.md](../../../TEST_STATUS.md)). Write the tests anyway; don't skip them.
