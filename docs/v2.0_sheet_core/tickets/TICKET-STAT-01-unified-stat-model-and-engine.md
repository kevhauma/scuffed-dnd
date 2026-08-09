# TICKET-STAT-01 — The unified Stat model and engine

- **Area:** Stats configuration
- **Type:** Refactor + Feature (breaking schema change — the milestone's centrepiece)
- **Traceability:** Concept [01 · Stat](../../excel%20export%20summary/concepts/01-stat.md); Concept [00 · Field model](../../excel%20export%20summary/concepts/00-field-model.md) §2.1

## User story

As a User, I want one Stat concept — invested axes like Strength, resource axes like Mana,
derived axes like APT, distinguished by flags — so my ruleset can express what the sheet has:
nine stats where Mana is *both* invested and tracked.

## Description

The sheet's nine stats live on one concept; the app split investable (`MainSkill`) from trackable
(`Stat`-with-formula), making resource stats like the sample character's Mana 310 unrepresentable.
This ticket merges them: types, character shape, and calculators. The config panel is
TICKET-STAT-02; wizard and sheet are TICKET-STAT-03.

## Current situation (as-is)

- [`MainSkill`](../../../src/types/config.ts) `{ code, name, description, maxLevel }` is the
  invested atom; [`Stat`](../../../src/types/config.ts) is always a formula over main skills
  ([`statCalculator.ts`](../../../src/engine/calculators/statCalculator.ts)) — it can hold no
  race base, investment, or modifier.
- Every app `Stat` implicitly gets a current value (`currentStatValues` seeded to all maxima in
  [`characterStore.ts`](../../../src/stores/characterStore.ts)); the spec gates that behind
  `is_resource`. None of the spec's fields (`abbreviation`, `order`, `counts_toward_total`,
  `is_resource`, value `min`/`max`, `rounding`) exist, and no stat total is computed anywhere.

## Desired result (to-be)

- One `Stat` entity replaces both: `{ id, name, abbreviation, description, order,
  countsTowardTotal, isResource, formula?, min?, max?, rounding }` — a stat with a `formula` is
  derived and accepts no investment. `Configuration` gains `schemaVersion: 2` (IO-03 owns the
  rejection UX).
- `Character` replaces `mainSkillLevels` with `investedStatPoints: Record<statId, number>`
  (0-default for every stat — retiring the missing-allocation half of the v1.0 bug) and narrows
  `currentStatValues` to `currentResourceValues` for `isResource` stats only.
- One composition calculator: `race base (0 until RACE-02) + invested (1:1 until ARC-02) +
  equipment (existing bonuses via a temporary abbreviation bridge until MAT-02)`, then `min`/`max`
  clamp and `rounding`; derived stats evaluate over `stats.*`/`const.*`/`curve.*` with FORM-05
  error values; `statTotal` sums the `countsTowardTotal` stats on `CalculatedCharacter`.

## Implementation notes (2026-08-09)

1. **The flat code space now holds stat abbreviations.** The to-be's "temporary abbreviation
   bridge" is load-bearing in more places than equipment: a speciality or combat `bonusFormula`
   naming `STR`, and the `skillCode` on every race and material modifier, both point into that one
   space. Repointing it at `Stat.abbreviation` is what let `MainSkill` be deleted without
   redesigning four other entities in the same ticket. `stats.<name-slug>` is unchanged and is
   what the confirmed APT derivation uses; the slug did **not** retire in favour of the
   abbreviation, because criterion 3 spells it `stats.speed`.
2. **Racial modifiers still apply.** The to-be reads "race base (0 until RACE-02)", which is the
   *new* Concept 04 term and is indeed 0. `Race.skillModifiers` is a different idea and keeps
   working through the bridge — dropping it here would silently unbalance every existing character
   two tickets before RACE-02 restores it.
3. **`maxLevel` retired without replacement.** The old per-skill investment cap is gone, as the
   ticket's notes say, so `validateStatAllocation` reports `negative-points` and `derived-stat`
   rather than `above-max-level`. A per-stat investment cap, if wanted, is an additive field.
4. **Raised by the convention review and fixed here**: the v1 load path now refuses rather than
   crashing (`StorageSchemaError` — IO-03 still owns the *notice*), a stat's abbreviation is
   guarded for User input as well as at import, a stat's rename carries its character half, a
   character's focus stat counts as a reference again, and `currentResourceValues` rejects
   non-resource ids in the store rather than trusting the component.
5. **Left for a later ticket**: `engine/skillAllocation.ts` is now entirely about stat points but
   keeps its filename, and `Configuration.mainSkillPointBudget` keeps its name because renaming it
   is a persisted-shape change. TICKET-RES-02 retires the field outright.

## Acceptance criteria

- [x] The unified type replaces both old entities; `MainSkill` is gone; `npx tsc --noEmit` holds its documented baseline. (`types/config.ts` — one `Stat` with `abbreviation`/`order`/`countsTowardTotal`/`isResource`/`formula?`/`min`/`max`/`rounding` plus `Configuration.schemaVersion: 2`; `MainSkill`, `mainSkillCalculator.ts` and `components/config/skills/main/` are deleted. `npx tsc --noEmit` reports exactly the 2 errors in TEST_STATUS.md, confirmed by the `verifier` subagent.)
- [x] Three kinds work through the engine: invested, resource (invested + tracked max/current), derived (formula, no investment, no current) — one test each. (`engine/calculators/statCalculator.ts`; `statCalculator.test.ts` — "should compose an invested stat from the points put into it", "should read a resource stat as a maximum, composed the same way" (Mana 310, the case the v1 split could not express), "should compute a derived stat from its formula and ignore any investment")
- [x] APT expressible: `max(1, round(stats.speed / const.apt_value))` → 1 at Speed 30 (confirmed sample). (`statCalculator.test.ts` — "should give 1 attack at Speed 30", plus "should hold at 1 below the threshold, and step up past it" for the step either side. Needed the new `stats.*` resolver, `engine/formula/stats.ts`.)
- [x] `statTotal` counts only flagged stats; `min`/`max`/`rounding` tested at boundaries. (`calculateStatTotal`; `statCalculator.test.ts` — "should sum only the stats flagged as counting", "should skip a stat whose value could not be computed rather than poisoning the total", "should hold a value at its floor and its ceiling", "should round the way the stat asks, after clamping", "should clamp before rounding, so a bound is never rounded past")
- [x] New-character seeding: resources at computed maxima, nothing else gets a current value; the v1.0 add-a-stat regression stays green. (`characterStore.createCharacterFromData` filters to `isResource`; `characterStore.test.ts` — "should seed current stat values to their calculated maxima", "should seed the stats that calculate and leave out only the broken one", "should drop a value for a stat the configuration does not define". CALC-02's two regressions carried across and still pass: `CharacterSheet.test.tsx` — "should calculate a new stat over it rather than chipping the sheet"; `CharacterCreationWizard.test.tsx` — "should preview numbers on review before anything is allocated".)
- [x] Existing panels/wizard/sheet updated mechanically to compile and function; UX rework explicitly deferred to STAT-02/03. (Stats panel carries the new fields, `MainSkillPointBudget` became `stats/StatPointBudget` with its test ported, the wizard allocates by stat id, the sheet's `StatsSection` gives a resource a `StatEditor` and every other stat a `SkillBreakdownRow`. `examples/demo-ruleset.json` re-authored to the v2 shape and asserted to import.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (`verifier`: 1094 tests passing, 0 failed, 0 skipped; `tsc` at the documented 2-error baseline; `yarn run lint` clean. `conventions-reviewer`: 10 findings — 8 fixed here (see note 4, plus the missing `stats.test.ts` and `StatPointBudget.test.tsx`, and both knowledge skills), 2 recorded as deferrals in note 5. `fallow audit --base HEAD`: no dead code introduced; the two complexity findings it raised on new code were reduced by extracting `statFormError` from `handleSave` (24/20 → 17/12) and the `pass` helper from `calculateStatValues` (off the report entirely). The duplication it reports across the configuration panels is the pre-existing eight-panel header pattern, already spun off as its own follow-up during TICKET-CRV-03.)

## Notes

- Sequence inside the ticket: types → engine → stores → mechanical UI updates.
- **Carry [TICKET-CALC-02](./TICKET-CALC-02-seed-configured-main-skills.md)'s invariant across:
  *every configured stat has a value; absence is not a state.*** The composition calculator seeds
  every stat in `config.stats` before applying invested points, race bases and equipment, so the
  namespace handed to the formula engine is the configured namespace, complete. `Undefined
  variable` stays reserved for references the configuration genuinely does not define. Carry the
  regression tests over too — `CharacterSheet.test.tsx` → *"should calculate a new stat over it
  rather than chipping the sheet"* and `CharacterCreationWizard.test.tsx` → *"should preview
  numbers on review before anything is allocated"*, both of which fail the moment a stat goes
  missing from the context rather than reading 0.
- [`examples/demo-ruleset.json`](../../../examples/demo-ruleset.json) must be re-authored to the
  v2 shape or deleted — a stale example is worse than none.
- Old `maxLevel` (investment cap) is replaced by value clamps; if per-stat investment caps are
  wanted separately later, that's an additive field.
