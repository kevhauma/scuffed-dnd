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

- [ ] The wizard has four navigable steps; moving back and forward preserves every value already entered.
- [ ] Step 1 requires a non-empty name and allows selecting zero or more races (Req 11.1, 11.2).
- [ ] Step 2 allocates a level per main skill, never above that skill's `maxLevel`, and displays racial modifiers separately from the allocated base level (Req 11.3).
- [ ] Step 3 offers exactly one focus stat chosen from main **and** speciality skills, and states the bonus level it grants (Req 11.4).
- [ ] Step 4 shows derived stats, speciality totals, and combat bonuses read from TICKET-CALC-01's `calculateCharacter()` — no arithmetic is re-implemented in the wizard (Req 11.5).
- [ ] Confirming calls `createCharacter()` exactly once and navigates to `/play/character/$id` for the returned character.
- [ ] The created character starts with an empty inventory — no equipped items, empty `miscItems` — and the slots it can fill are derived from the configuration's `equipmentSlots` rather than copied onto the character (Req 11.6).
- [ ] Persistence happens only through the store action; the wizard never calls `saveCharacters()` or `localStorage`.
- [ ] Invalid input blocks progression with a visible message rather than failing silently or on submit.
- [ ] With no configuration loaded, the route renders an explanatory state and no form.
- [ ] Steps compose `components/ui` primitives (`Card`, `Input`, `Select`, `Button`, `Label`, `Text`); no raw HTML form controls, and base components gain no layout classes.
- [ ] Wizard state and handlers live in a `useCharacterCreation` hook, not in the step components.
- [ ] Unit tests cover: name validation blocks step 1; `maxLevel` cap enforced in step 2; racial modifier shown separately from base level; focus-stat options include both main and speciality skills; review values match `calculateCharacter()` for a fixture; confirm calls `createCharacter` with the assembled `CharacterCreationData`; no-configuration state.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: with a configuration loaded, walk all four steps, confirm, and land on the new character's sheet; reload and confirm the character persisted and appears in `/play`.

## Notes

- **The point budget shipped in
  [TICKET-SKL-01](./TICKET-SKL-01-main-skill-point-allocation-rules.md)** (2026-08-01), so this
  ticket is no longer blocked on it. Step 2 consumes `validateMainSkillAllocation` and renders
  `pointsSpent` / `pointsRemaining` / `violations`; it must not re-implement the arithmetic or
  invent a rule inline. SKL-01 left its own "CHAR-02 consumes the validator" criterion pointing
  here, so satisfying 11.3 in step 2 closes both.
- Multi-race bonuses combine additively (Req 8.3, 8.4) — that is already the calculator's job; the
  wizard only has to display them separately from allocated levels.
- `createCharacterFromData()` already initialises `currentStatValues: {}` and an empty inventory,
  so the wizard passes creation data only. But an empty `currentStatValues` means a new character
  starts at 0 current HP/mana until the sheet writes one — decide whether creation seeds current
  values to their calculated maximum (likely what a Player expects) and, if so, do it in the store
  action where the rest of the character shape is assembled, not in the wizard component.
- Speciality skill base levels are part of `CharacterCreationData`; if the configuration defines
  speciality skills, the wizard needs a place to set them — fold into step 2 alongside main skills
  rather than adding a fifth step.
- This is a hook-heavy component and will land in the documented React 19 + Vitest known-failing
  bucket ([TEST_STATUS.md](../../../TEST_STATUS.md)). Write the tests anyway; don't skip them.
