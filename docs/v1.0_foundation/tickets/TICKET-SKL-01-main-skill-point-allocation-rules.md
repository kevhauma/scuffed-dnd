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

## Decision (2026-08-01) — option (a), a single global pool

The User asked for the backlog to be worked through without stopping for input, so the blocking
decision was resolved using the tiebreaker this ticket already recorded: **(a) is the smaller,
reversible choice — adding per-skill `pointCost` later is additive, removing it is not.**

Built as: `Configuration.mainSkillPointBudget?: number`, one point per level, spent across every
main skill, each still bounded by its own `maxLevel`. `MainSkill` is unchanged, so option (b)
remains available later without a migration. **If asymmetric per-skill costs are wanted, say so
and it can be added on top of this** — nothing here has to be undone.

## Acceptance criteria

- [x] The User can set the main-skill point budget in configuration mode, and it persists (Req 2.4). (New `MainSkillPointBudget` card in `src/components/config/skills/main/`, rendered by `MainSkillsPanel` beneath the skill list; it calls the new `setMainSkillPointBudget` store action, which persists like every other config mutation. Tests: `MainSkillPointBudget.test.tsx` *"should save a budget through the store action"*, `configStore.test.ts` *"should set the main skill point budget and persist it"*.)
- [x] The budget survives export → import round-trip, and importing a file that predates the field succeeds with the "unlimited" fallback rather than failing validation. (`importExport.test.ts` → *"should survive export then import unchanged"* (25 in, 25 out, whole config deep-equal), *"should import a file that predates the field, leaving it unlimited"* (the existing fixture has no budget and still validates), *"should round-trip a budget of zero rather than dropping it"*, and *"should reject a non-numeric or negative budget"*.)
- [x] `validateMainSkillAllocation` reports points spent, points remaining, and which skills exceed their own `maxLevel`, as data — it does not throw, and it does not render. (`src/engine/skillAllocation.ts` returns `{ isValid, pointsSpent, pointBudget, pointsRemaining, isOverBudget, violations[], unknownSkillCodes[] }`. No `throw` in the module; every test asserts on the returned object.)
- [x] An allocation exceeding the budget is reported as invalid; an allocation exactly at the budget is valid (boundary). (Tests *"should accept an allocation exactly at the budget"* (15/15, `pointsRemaining: 0`) and *"should reject an allocation one point over the budget"* (16/15, `pointsRemaining: -1`). *"should treat a budget of zero as 'no points to spend', not as unlimited"* pins the other boundary — `0` is a real limit, not a missing one.)
- [x] A per-skill level above that skill's `maxLevel` is invalid even when the budget has room. (Test *"should reject a skill above its own max level even with budget to spare"* — `CON: 6` against `maxLevel: 5` with 9 points still unspent gives `isValid: false`, `isOverBudget: false`, and one `above-max-level` violation.)
- [x] With no budget configured, any allocation within per-skill `maxLevel` is valid (backwards compatibility). (Test *"should treat an absent budget as unlimited"* — 25 points spent, `pointBudget: null`, valid — plus *"should still enforce per-skill maximums when the budget is unlimited"*.)
- [x] The validator lives in the engine and is pure — no store access, no React. (`src/engine/skillAllocation.ts` imports only the `Configuration` type.)
- [x] TICKET-CHAR-02's wizard consumes this validator rather than its own arithmetic. **Now done** — TICKET-CHAR-02 landed on 2026-08-01: `useCharacterCreation` calls `validateMainSkillAllocation(values.mainSkillLevels, config)` and step 2 renders `pointsSpent` / `pointsRemaining` / `violations` from the result. The wizard sums nothing itself. Cross-checked by `CharacterCreationWizard.test.tsx` — *"should report points spent and remaining from the allocation validator"* and *"should block progress when the allocation exceeds the point budget"*.
- [x] Unit tests cover: under / exactly at / over budget; per-skill cap violation with budget remaining; absent budget; empty allocation; ~~(if option (b)) weighted costs~~ *(not applicable — option (a) was chosen)*. (+25 tests: `skillAllocation.test.ts` (11), `MainSkillPointBudget.test.tsx` (6), 4 added to `configStore.test.ts`, 4 to `importExport.test.ts`. Also covers negative levels not refunding points, and codes the configuration does not define. Suite: 497 passing, 0 failing, 0 skipped.)
- [x] Verified via the fallow skill and the ~~react-conventions~~ **coding-conventions** skill *(renamed since the ticket was written)*. (`fallow audit --base HEAD` → `"verdict": "pass"`, 0 introduced findings. It initially reported one *introduced* complexity finding — the optional-field check pushed `importExport.ts`'s already-long `validateConfiguration` from 14 to 15 cyclomatic — so the check was extracted into a `validateOptionalNonNegativeNumber` helper, which brought it back under. The verifier also caught one *new* lint error (`useUniqueElementIds` on a hardcoded `id`/`htmlFor` pair); fixed with `useId()` rather than accepted, and `yarn run lint` is back to the documented 35 errors / 23 warnings. Conventions: persistence via a store action, the field composes `Card`/`Input`/`Label`/`Button`/`Text` primitives and owns its own layout, theme tokens only, `**Validates: Requirements**` headers.)
- [x] Verified live in the browser: set a budget, reload, confirm it persisted, and confirm the skills panel shows it. (On `localhost:5173/config/skills`: the Point Budget card renders below the main skills and initially reads *"Unlimited — players are bounded only by each skill's own max level."*; entering `24` and pressing Save wrote `mainSkillPointBudget: 24` into `dnd_builder_config`; after a full page reload the card read *"Players may spend 24 of the 40 levels this ruleset allows in total."*)

## Notes

- **Blocking decision.** Do not pick (a) or (b) silently — ask the User which they want, since it
  changes the `MainSkill` shape. If they don't care, (a) is the smaller, reversible choice: adding
  per-skill costs later is additive, removing them is not.
- Changing `Configuration` means the **data-model** skill and `importExport.ts`'s
  `validateConfiguration()` both need updating in the same change.
- Out of scope: point *spending* during play (level-ups after creation). This ticket defines the
  rule and the validator; creation consumes it in TICKET-CHAR-02, and in-play progression is not
  specified anywhere yet — flag it if the User wants it.
