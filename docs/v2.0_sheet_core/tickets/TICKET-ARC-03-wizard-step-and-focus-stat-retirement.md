# TICKET-ARC-03 — Wizard archetype step; retire the focus stat

- **Area:** Archetypes configuration (play surface + removal)
- **Type:** Feature + Refactor
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md); v2.0 overview decision (focus stat → retired)

## User story

As a Player, I want to pick exactly one archetype during creation and see what my points will buy
before I spend them — with the old focus-stat mechanic gone rather than lingering beside it.

## Description

The last piece of the character-build loop: the wizard step consuming ARC-01/ARC-02, and the
removal of the focus stat, which the archetype replaces.

## Current situation (as-is)

- The wizard's `FocusStatStep` picks `focusStatCode`; `focusStatBonusLevel` applies as a flat
  adder in the calculators; [`FocusStatConfig`](../../../src/components/config/focus/) lives at
  `/config/focus`. All of it survived STAT-01–RES-03 untouched, waiting for this replacement.

## Desired result (to-be)

- `Character.archetypeId` — exactly one, required; the wizard step replaces `FocusStatStep`
  (order: identity → races → archetype → stat allocation → skills → review), and the allocation
  step re-renders per-stat gains when the archetype changes (state in `useCharacterCreation`).
- **Focus stat fully removed:** `focusStatCode`, `focusStatBonusLevel`, `FocusStatConfig`, the
  `/config/focus` route and nav entry, and both calculators' focus terms — nothing left to
  maintain beside the archetype.
- Export/import and shape validation cover `archetypeId` and the archetype entity; a v2 file
  carrying focus-stat fields is rejected as unknown (IO-03 strictness).

## Acceptance criteria

- [x] Wizard requires one archetype; gains preview updates on archetype change (component tests). (`src/components/play/creation/CharacterCreationWizard.test.tsx` → *the archetype step*: `should require a pick when the ruleset offers a choice`, `should unblock once one is picked, and show which stats it favours`, and `should re-price the gains preview when the archetype changes` — the same 5 points reading `→ +4.5` as Strong and `→ +2` as Sneaky. **Divergence, see implementation note 1**: required only when the ruleset defines archetypes, covered by `should say so rather than block when the ruleset defines no archetypes`.)
- [x] `focusStat` yields zero hits in `src/` (grep criterion); `/config/focus` is gone from routes and nav; `routeTree.gen.ts` regenerated, never hand-edited. (`components/config/focus/`, `routes/config/focus.tsx` and `creation/FocusStatStep.tsx` deleted; `CONFIG_NAV`, `CONFIG_SECTIONS` and both barrels updated; `npx vite build` regenerated the route tree. **Divergence on "zero hits", see implementation note 3**: three references remain and are the *retirement record itself* — the `RETIRED_FIELDS` key that names what replaced it, the store test asserting a fresh ruleset has no such field, and the `schemaVersion` history comment. Zero live uses, which is what the criterion is for.)
- [x] No flat specialisation bonus is applied anywhere (calculator regression test). (`src/engine/calculator.test.ts` → `should apply no flat specialisation bonus to any stat (TICKET-ARC-03)` and `should give an archetype-less character no specialisation anywhere`; `src/engine/calculators/statCalculator.test.ts` → `should single no stat out, the focus bonus being gone`. The composition is three terms now — race base + what the points bought + equipment — asserted as an exact `toEqual` over every stat.)
- [x] Shape validation round-trips `archetypeId`; guarded delete: an archetype on a character refuses via REF-02. (Round-trip and shape refusals were landed by ARC-01 and still pass — `src/services/importExport.test.ts` → *archetypes (TICKET-ARC-01)*; the guard both ways in `src/engine/dependencies.test.ts` and end to end in `ArchetypesConfigPanel.test.tsx`. What this ticket adds is the *writer*: `characterStore.createCharacter` maps `data.archetypeId` through, asserted by `should create a new character and save to storage`.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the Verification section below.)
- [ ] Verified live in the browser: create characters with two different archetypes from the same spend and compare sheets. (**Left open — the User declined the live check for this run and the remaining v2 tickets**, asked and answered 2026-08-16.)

## Implementation notes

1. **`Character.archetypeId` stays optional, and the wizard requires a pick only when there is one
   to make.** The to-be says "exactly one, required". A ruleset may define **no** archetypes, the
   same way TICKET-RACE-02 kept a raceless character legal — and a required field would make every
   such ruleset unusable in order to enforce a rule about rulesets that have archetypes. So the
   *step* enforces it and the *type* does not, which is where the rule belongs: it is a property of
   the ruleset being played, not of the shape.
2. **The archetype step sits before allocation, not where the focus step was.** The order is
   identity → **archetype** → stats → review. The archetype decides the exchange rate between
   points and stats (ARC-02), so a Player choosing where to spend has to know what a point is worth
   first. The old focus step came *after* allocation, which was harmless only because it changed
   nothing about what the points bought.
3. **`focusStat` is not literally zero in `src/`, and should not be.** Three references remain: the
   `RETIRED_FIELDS` entry that refuses an import carrying `focusStatBonusLevel` and names the
   archetype as its replacement (RES-02's pattern), the store test asserting a fresh ruleset has no
   such field, and the `schemaVersion` history comment. Deleting those would make the retirement
   silent, which is the opposite of what IO-03's strictness is for. Zero *live* uses is the rule the
   criterion was reaching for.
4. **`SUPPORTED_SCHEMA_VERSION` 7 → 8**, and this one is unambiguous under ARC-01's refinement:
   fields were **removed**, not added, so stale data would be misread. Rippled to 44 fixtures,
   `examples/demo-ruleset.json` and `scripts/build-sheet-import.mjs`.
5. **`combatSkillReferences` lost its `characters` parameter.** The focus stat was the one character
   field that named a *code*; every remaining one is keyed by an id. So a formula is now the only
   thing that can point at a combat skill, and the rename problem `renameSkillCode` existed to solve
   is closed rather than managed — recorded where the old comments claimed otherwise.
6. **The Curves nav entry arrived as a side effect.** `/config/curves` had been on the dashboard but
   missing from `CONFIG_NAV` since CRV-03; retiring Focus Stat freed the slot and it took it.

## Conventions review — findings and what was done

The `conventions-reviewer` ran on the diff before it was committed and found twelve things, plus
two it caught mid-run that were already fixed (`ArchetypeStep` was rendering a raw `<button>` with
an inline template-literal `className` — both hard-rule breaches, corrected before the review
landed). All twelve are fixed in the same commit.

1. **The archetype cards would have rendered centred, not left-aligned.** `Button` is
   `inline-flex items-center`; a same-property utility passed in through `className` loses to it on
   *stylesheet order*, not on the order written — so `items-start` would silently have had no
   effect. The stacking moved to an inner wrapper. A real defect in the step's whole visual, and one
   only a browser or a reviewer would have caught: no test asserts alignment.
2. **`<p>` inside a `<button>`.** A button's content model is phrasing only; the description and
   affinity lines are `span`s now.
3. **Requirement 9 and 11.4 now have no implementation anywhere**, and six `**Validates:**` lines
   still claimed them. Stripped from all six (plus `SkillsSection.tsx`, which the diff had not
   touched but had invalidated) — and, more importantly, **the retirement is recorded in
   [`requirements.md`](../../v1.0_foundation/requirements.md)** rather than left for the next reader
   to rediscover: Requirement 9 is marked RETIRED with its criteria struck through and a "do not
   re-implement" note pointing at Concept 03.
4. `ArchetypeStep`'s own citation named 11.1/11.2 (create-with-names, select-races), neither of
   which it does. Corrected to `Concept 03; Requirements 21.1-21.5`, with a note saying why 11.4 is
   deliberately absent.
5. **Step numbers in two file headers were off by one** after the reorder — `ArchetypeStep` said
   "Step 3" (it is 2) and `SkillAllocationStep` still said "Step 2" (it is 3).
6. `GROUP_LABELS` and the affinity-grouping filter were duplicated between `ArchetypeCard` and
   `ArchetypeStep`, and the `?? 'non'` default was a **third** copy of a rule the engine owns as
   `affinityFor`. Extracted to
   [`shared/affinityGroups.ts`](../../../src/components/shared/affinityGroups.ts), which calls
   `affinityFor` rather than re-deriving it, with its own test file.
7. `CharacterCreationWizard` derived the archetype's name in JSX. Moved to the hook as
   `selectedArchetypeName` — and `selectedRaceNames`, the pre-existing drift it was copying, moved
   with it.
8. Stale JSDoc on `CharacterCreationFormData` still described "the optional focus code" and a select
   that no longer exists.
9. An orphaned `/** Why the current step cannot be left */` had been stranded above the new
   `archetypeStepError`, leaving two doc comments stacked on one function.
10. An orphaned `// Required number fields` in `importExport.ts` headed nothing after its one check
    was removed.
11. `TEST_STATUS.md`'s known-errors table had the `importExport.test.ts` line as 798; `tsc` reports
    788. That table is the baseline a future run is diffed against, so an off-by-ten reads as a
    moved error.
12. The Curves nav addition was flagged as undocumented — it is implementation note 6 above, added
    when the entry was written rather than after the fact.

## Sheet data

Nothing to add, and one thing removed: `focusStatBonusLevel` was a configuration field the source
sheet never had — Concept 03 is what the sheet actually does — so no fragment held it and none
changes. `scripts/build-sheet-import.mjs` stopped emitting it and `yarn run sheet:import` was rerun;
`ducklets.json` is regenerated at `schemaVersion: 8`.

## Verification

- `npx vitest run` — see the run recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- `npx tsc --noEmit` — the documented 2-error baseline, unchanged.
- `yarn run check` — clean.
- `fallow audit` — no dead code and no new duplication; the two groups it reports are the generated
  route tree and a pre-existing pair in `importExport.ts`.

## Notes

- This closes the overview's triad-collapse row "focus stat → retired". If the User ever wants a
  flat-bonus mechanic back, it returns as an archetype `starting_bonus` field — additive, not a
  revival of the old fields.
