# TICKET-SKL-01 — Point allocation rules for main skills

- **Area:** Skills configuration
- **Type:** Feature
- **Traceability:** Requirements 2.4, 11.3
- **Replaces plan items:** none — §11.1 shipped the skills panel without this

## User story

As a User, I want to define how many points a Player may spend on main skills, so that characters
built on my ruleset are balanced against each other instead of maxed out everywhere.

## Description

Requirement 2.4 says the User can define point allocation rules for Main_Skills, and 11.3 says the
Player allocates points "according to User-defined rules". Neither exists: the configuration has
no concept of a point budget, so today a Player could raise every skill to its `maxLevel` and the
ruleset has no say. This ticket adds the rule to the configuration and its enforcement surface.

## Current situation (as-is)

- [`MainSkill`](../../../src/types/config.ts) is `{ code, name, description, maxLevel }` — a
  per-skill ceiling and nothing else. [`Configuration`](../../../src/types/config.ts) has no
  budget field either; the only global knob is `focusStatBonusLevel`.
- The glossary in [requirements.md](../requirements.md) defines Main_Skill as "a foundational skill
  identified by a 3-letter code **with a level and points**" — the "points" half was never modelled.
- [`MainSkillFormDialog`](../../../src/components/config/skills/main/MainSkillFormDialog.tsx) and
  [`useMainSkillManager`](../../../src/components/config/skills/main/useMainSkillManager.ts) edit
  code / name / description / maxLevel only.
- `Character.mainSkillLevels` is a free `Record<code, number>`; nothing validates it on creation or
  edit, because there is no rule to validate against.
- This is the open question recorded in
  [TICKET-CHAR-02](./TICKET-CHAR-02-character-creation-wizard.md) — the wizard cannot satisfy 11.3
  until this lands.

## Desired result (to-be)

- The configuration carries a main-skill point budget. **Decide the shape with the User before
  building** — the two defensible options are:
  - **(a) A single global pool**: `Configuration.mainSkillPointBudget: number`; each level costs
    one point; a character's allocation is valid when the sum of allocated levels ≤ budget and each
    skill ≤ its own `maxLevel`. Simple, matches "allocate points to Main_Skills" most directly.
  - **(b) Per-skill cost weighting**: the pool above plus a `pointCost` per `MainSkill`, so a
    powerful skill can be made expensive. Strictly more expressive, more UI, and only worth it if
    the User actually wants asymmetric costs.
- Whichever is chosen, the configuration UI exposes it (a field on the skills panel for the pool,
  and per-skill if (b)), and the value round-trips through export/import.
- A pure validator — `validateMainSkillAllocation(levels, config)` in `src/engine/` — returns
  points spent, points remaining, and per-skill violations. Both the creation wizard and any later
  level-up UI consume it; neither re-implements the arithmetic.
- An existing configuration without the field keeps working: absent budget means unlimited, so
  saved rulesets and characters don't become invalid on upgrade.

## Acceptance criteria

- [ ] The User can set the main-skill point budget in configuration mode, and it persists (Req 2.4).
- [ ] The budget survives export → import round-trip, and importing a file that predates the field succeeds with the "unlimited" fallback rather than failing validation.
- [ ] `validateMainSkillAllocation` reports points spent, points remaining, and which skills exceed their own `maxLevel`, as data — it does not throw, and it does not render.
- [ ] An allocation exceeding the budget is reported as invalid; an allocation exactly at the budget is valid (boundary).
- [ ] A per-skill level above that skill's `maxLevel` is invalid even when the budget has room.
- [ ] With no budget configured, any allocation within per-skill `maxLevel` is valid (backwards compatibility).
- [ ] The validator lives in the engine and is pure — no store access, no React.
- [ ] TICKET-CHAR-02's wizard consumes this validator rather than its own arithmetic (cross-check when that ticket is built; if it landed first, update it in this ticket).
- [ ] Unit tests cover: under / exactly at / over budget; per-skill cap violation with budget remaining; absent budget; empty allocation; (if option (b)) weighted costs summing correctly.
- [ ] Verified via the fallow skill and the react-conventions skill.
- [ ] Verified live in the browser: set a budget, reload, confirm it persisted, and confirm the skills panel shows it.

## Notes

- **Blocking decision.** Do not pick (a) or (b) silently — ask the User which they want, since it
  changes the `MainSkill` shape. If they don't care, (a) is the smaller, reversible choice: adding
  per-skill costs later is additive, removing them is not.
- Changing `Configuration` means the **data-model** skill and `importExport.ts`'s
  `validateConfiguration()` both need updating in the same change.
- Out of scope: point *spending* during play (level-ups after creation). This ticket defines the
  rule and the validator; creation consumes it in TICKET-CHAR-02, and in-play progression is not
  specified anywhere yet — flag it if the User wants it.
