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

## Acceptance criteria

- [ ] The unified type replaces both old entities; `MainSkill` is gone; `npx tsc --noEmit` holds its documented baseline.
- [ ] Three kinds work through the engine: invested, resource (invested + tracked max/current), derived (formula, no investment, no current) — one test each.
- [ ] APT expressible: `max(1, round(stats.speed / const.apt_value))` → 1 at Speed 30 (confirmed sample).
- [ ] `statTotal` counts only flagged stats; `min`/`max`/`rounding` tested at boundaries.
- [ ] New-character seeding: resources at computed maxima, nothing else gets a current value; the v1.0 add-a-stat regression stays green.
- [ ] Existing panels/wizard/sheet updated mechanically to compile and function; UX rework explicitly deferred to STAT-02/03.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill.

## Notes

- Sequence inside the ticket: types → engine → stores → mechanical UI updates.
- [`examples/demo-ruleset.json`](../../../examples/demo-ruleset.json) must be re-authored to the
  v2 shape or deleted — a stale example is worse than none.
- Old `maxLevel` (investment cap) is replaced by value clamps; if per-stat investment caps are
  wanted separately later, that's an additive field.
