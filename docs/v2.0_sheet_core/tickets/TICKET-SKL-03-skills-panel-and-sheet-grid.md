# TICKET-SKL-03 — Skills panel, sheet grid, and skill validation

- **Area:** Skills configuration
- **Type:** Feature
- **Traceability:** Concept [02 · Skill](../../excel%20export%20summary/concepts/02-skill.md) (editor, validation, display)

## User story

As a User, I want to edit a skill's stat weights as rows, and as a Player I want my sheet to show
each skill's level and bonus with its breakdown, so the skill system is visible and tunable.

## Description

The UI and validation for TICKET-SKL-02's entity: config panel, sheet grid, and the concept
page's three validation rules.

## Current situation (as-is)

- Post-SKL-02 the entity and derivation exist; the speciality panel and the sheet's
  `SpecialitySkillsSection` are mechanically adapted but still formula-string-shaped, and none of
  the concept page's validation rules are implemented.

**Correction found on pickup (2026-08-14).** The as-is overstated what was left. SKL-02 had already
replaced the panel's formula field with `useFieldArray` weight rows against configured stats, and
`SkillCard` already read `STR × 0.2` — so to-be bullet 1 was *untested*, not unbuilt, and this
ticket's work on it is the test layer plus one defect it exposed. Bullets 2 and 3 were as described:
the sheet showed the bonus alone (`SkillsSection`'s own header deferred the grid here), and one of
the three rules existed while `ValidationSeverity` had no `information` channel at all.

## Desired result (to-be)

- The Skills panel edits `statWeights` as add/remove/change rows against configured stats
  (domain shape, replacing the speciality panel's formula field).
- The sheet's skills grid shows **level and bonus** per skill with a labelled breakdown (stat
  contributions by weight, invested) via `SkillBreakdownRow`.
- Validation per the concept page: zero-weights-and-no-investment warns (always level 0);
  weight sum far above ~0.5 surfaces as *information*; near-duplicate skill names warn
  (`skinning`/`Skinning`) — all through the standard validation report with distinct severities.

## Acceptance criteria

- [x] Weight-row editing works end-to-end through the manager hook and store actions (component tests for add/remove/change). (Two new files, 16 tests: [`useSkillManager.test.ts`](../../../src/components/config/skills/skill/useSkillManager.test.ts) covers add/remove/change-stat/change-weight, `handleEdit` loading rows back, and an edit reusing the skill's id rather than minting one; [`SkillsPanel.test.tsx`](../../../src/components/config/skills/skill/SkillsPanel.test.tsx) drives the same three operations through the dialog's own controls — "should add a weight row to an existing skill and store it", "should remove a weight row…", "should change a weight row's stat and weight" — asserting the store, never the DOM's arithmetic.)
- [x] Sheet grid renders level + bonus + breakdown from the calculator; no component re-derives arithmetic. ([`skillCalculator.ts`](../../../src/engine/calculators/skillCalculator.ts) returns a third map, `contributions`, with `weight × statValue` already multiplied; `useCharacterSheet` only pairs each `statId` with its abbreviation to make a label. `CharacterSheet.test.tsx` → "the skills grid (TICKET-SKL-03)": Stealth renders `DEX × 0.5 +3`, `invested +3`, `level 6` and bonus `1`, with level and bonus asserted against `calculateCharacter` rather than literals. Five calculator tests in `skillCalculator.test.ts` → "the breakdown behind a level" prove the terms sum to the level exactly.)
- [x] The three validation rules appear with their severities (warning / information / warning) in the validation report (tests each). ([`validator.ts`](../../../src/engine/validator.ts): zero-weights → warning, weight sum > 0.5 → `information`/`Balance`, near-duplicate names → warning. Eight tests in `validator.test.ts` → "skill validation (Concept 02, TICKET-SKL-03)", including `skinning`/`Skinning` naming both, one warning per colliding group, `Cooking`/`Cooling` left alone, and the 0.5 boundary not firing. `ValidationReport.test.tsx` adds two tests for the new section and its count.)
- [x] Components compose `ui/` primitives, own their layout, theme tokens only. (`SkillsSection` composes `Card`/`Text`/`SkillBreakdownRow`; the new `information` styling is `text-royal` via `informationIconStyles` in `ValidationReport.style.ts` — a theme token, no raw hex or stock palette. `ValidationReport`'s three sections were folded into one local `issueSection` renderer rather than a third copy of the markup, which is why `fallow audit` reports 0 introduced clone groups.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the verification note below.)
- [ ] Verified live in the browser: edit a weight, watch level and bonus move on the sheet. **Left open at the User's request** — they declined the live check for this run (2026-08-14), consistent with every v2 ticket so far. The automated suite covers the store round-trip and the rendered numbers; what a browser would add is that editing a weight in config mode visibly moves the sheet without a reload.

## Notes

- The 57 seed skills come with the sheet-import milestone; the fresh-config seed stays minimal.

## Implementation notes

1. **`ValidationSeverity` gained a third member, and `ValidationReport` a third bucket.** Concept 02's
   balance rule is explicitly not a defect, and reporting it as a warning would train the User to
   ignore warnings — so `information` is its own channel that never touches `isValid`. Threaded
   through both flatteners (`useConfigDashboard`, `useConfigTransfer`) and the dashboard's count
   line; the `ui/ValidationReport` primitive mirrors the engine's union as it already did.
2. **The concept page's "and no invested points" half is not implementable here.** `validateConfiguration`
   sees a `Configuration` and never a character, so the zero-weights rule is stated about the
   ruleset — "its level is whatever the Player invests and nothing else" — rather than about any
   allocation. Confirmed as the intended reading with the User on pickup.
3. **`calculateCombatSkillBonuses` was narrowed to `Pick<CalculatedSkills, 'levels' | 'bonuses'>`.**
   Adding `contributions` to the return type would otherwise have forced `calculator.ts`,
   `combatRoll.ts` and nine test call sites to invent a breakdown they have no use for. A combat
   skill reads `skills.<name>.level` and `.bonus` and nothing else, so the narrower parameter is
   also the truer one.
4. **A failed level reports no breakdown at all.** `wis` may already have contributed 4.5 before
   `char` failed; showing that term would put a breakdown on screen that sums to a number the sheet
   is not displaying. Empty is the honest answer (Concept 00 §7). For the same reason
   `SkillBreakdownRow`'s new `secondary` slot is skipped when it carries an error — the total's chip
   already explains it, which is STAT-03's precedent against chipping one cause twice.
5. **One defect found while testing the editor:** clearing the weight box reads back as `NaN`
   through `valueAsNumber` and was persisted, poisoning every level the skill fed.
   `useSkillManager.handleSave` now reads a non-finite weight as the 0 the empty box looks like.
6. **`SkillsPanel.test.tsx` submits the `<form>` rather than clicking the submit button.** jsdom only
   translates a click into a submit event once React has committed the pending render, so a click
   landing straight after `fireEvent.change` on a controlled field is silently swallowed — the
   dialog stays open and the test fails for a reason unrelated to the code. Same `onSubmit` path; a
   separate test asserts the button is `type="submit"` inside a form, which is the part the direct
   dispatch cannot cover.
7. **No `docs/imports/` fragment is owed.** No persisted shape moved: `Skill`, `Configuration` and
   `Character`'s stored fields are untouched. `SkillStatContribution` lives on `CalculatedCharacter`,
   which is derived and never written, so `SUPPORTED_SCHEMA_VERSION` also stays where RACE-01 left
   the convention.

8. **The `conventions-reviewer` found one real defect and nine smaller things, all fixed in the same
   change.** The defect: the sheet rendered weighted terms as raw doubles, so a DEX of 7 at weight
   0.2 read `DEX × 0.2 +1.4000000000000001` — the exact problem `roundWeightSum` had just been
   added to the validator to avoid, and one this ticket *introduced* by showing the level at all.
   Fixed at the display edge in `SkillBreakdownRow` (a `readable` helper, the same two-decimal
   rounding `FormulaPreview` uses), never in the calculator, so the terms keep summing to the level
   exactly; covered by "should not show a weighted term as binary floating-point noise". The rest:
   the three section headings' class strings moved out of the JSX into a `severityStyles` record in
   `ValidationReport.style.ts` (which also collapsed `issueSection` from five arguments to three);
   the dashboard's counts line was gated on `isValid`, so a *note* — the one severity that exists to
   be read on a valid ruleset — could only ever appear beside an error, now gated on the issue count
   instead; "1 Info" became "1 Note"/"N Notes" to match the other two counts; `useSkillManager` and
   `SkillFormDialog` still carried headers promising that TICKET-SKL-03 would build what it had just
   built; four `**Validates:**` lines across the skill panel cited Requirements 4.1/4.2/2.5/2.6,
   all retired by STAT-01 and SKL-02; the balance message said "well above" of a strict `> 0.5`
   check that 0.51 also trips; `SkillStatContributionView.statId` had no reader; `BALANCED_WEIGHT_SUM`
   sat 250 lines below its use; a `getByText('1')` matched any node reading "1" rather than the
   bonus; and `SkillCard` still keyed weight rows by `statId` alone — the same collision this ticket
   fixed one file over.
9. **Left for later, deliberately.** `SkillBreakdownRow`'s `total`/`secondary` naming reads
   backwards now that the *bonus* is the total and the *level* is the secondary; renaming to
   `primary`/`secondary` touches `StatsSection` and the wizard and is not this ticket's scope. Two
   unrelated pre-existing items the review surfaced — `SkillFormFields` exported from
   `config/index.ts` with no importer, and `SkillFormDialog`'s `Select` driven by `watch` +
   `setValue` rather than `register` — are noted here rather than fixed.

## Verification (2026-08-14)

- `npx vitest run` — 1320 passing, 0 failing, 0 skipped (baseline 1284; +36 from this ticket).
- `npx tsc --noEmit` — the 2 documented baseline errors, nothing new.
- `yarn run lint` / `npx biome check` — clean.
- `fallow audit --base HEAD` — verdict **pass**, 0 introduced dead-code, complexity or duplication
  findings; the 2 dead-code and 1 complexity findings it lists are inherited.
