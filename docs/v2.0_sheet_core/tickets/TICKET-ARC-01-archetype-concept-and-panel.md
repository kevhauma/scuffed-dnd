# TICKET-ARC-01 — Archetype concept and panel

- **Area:** Archetypes configuration (new area)
- **Type:** Feature
- **Traceability:** Concept [03 · Archetype](../../excel%20export%20summary/concepts/03-archetype.md)

## User story

As a User, I want to define archetypes — each tagging every stat as main, sub, or non — so my
ruleset can say what a Strong or Funny character is good at growing.

## Description

The entity and its editor. The point-buy routing that makes affinity *do* something is
TICKET-ARC-02; the wizard step and focus-stat retirement are TICKET-ARC-03.

## Current situation (as-is)

- No archetype/affinity concept anywhere in `src/`. The only specialisation mechanic is the
  focus stat (`focusStatCode` + global `focusStatBonusLevel`) — a flat adder the spec doesn't
  recognize, retired in ARC-03.

## Desired result (to-be)

- `Archetype` entity `{ id, name, description, statAffinity: Record<statId, 'main' | 'sub' |
  'non'> }` with CRUD store actions and export/import shape coverage.
- An Archetypes panel at `/config/archetypes` (domain shape + dashboard card): per-stat affinity
  picker per archetype; the editor grows a row per configured stat.
- Validation: a stat absent from an archetype's affinity defaults to `non` with a warning (spec
  rule); the `point_buy` curve must have a column per affinity value used — a missing column is a
  named config-level validation error.

## Acceptance criteria

- [x] CRUD round-trips persistence and export/import via store actions. (`addArchetype` / `updateArchetype` / `deleteArchetype` in [`configStore.ts`](../../../src/stores/configStore.ts); `src/stores/configStore.test.ts` → *Archetypes CRUD (TICKET-ARC-01)*, including `should round-trip through export and import` and `should mint a fresh ruleset with no archetypes key at all`. Shape validation in `importExport.ts`, covered by `src/services/importExport.test.ts` → *archetypes (TICKET-ARC-01)*: absent-means-none, a full round-trip, and four refusals.)
- [x] The panel edits affinities per stat and grows a row when a stat is added (component test); default-to-non warning surfaces in the validation report. (`src/components/config/archetypes/ArchetypesConfigPanel.test.tsx` → `should offer a row per configured stat, defaulting an untagged one to non`, `should grow a row when a stat is added to the ruleset`, `should save a changed affinity through the store`, `should store a tagging sparsely, dropping a stat set back to non`. The warning: `src/engine/validator.test.ts` → *archetypes (TICKET-ARC-01)*, `should warn that an untagged stat defaults to non` and `should name every untagged stat in one warning rather than one each`.)
- [x] Missing point-buy column produces the named validation error (test). (`src/engine/validator.test.ts` → `should report a point_buy curve with no column for an affinity in use` and `should report a missing non column even when no archetype tags anything non` — the second is the case a naive "columns for the affinities actually used" check would miss, since an untagged stat defaults to `non`.)
- [x] Guarded delete via REF-02 (an archetype referenced by a character refuses with the list). (`'archetype'` added to `ReferenceTargetKind` with a case in [`dependencies.ts`](../../../src/engine/dependencies.ts); `src/engine/dependencies.test.ts` → `finds an archetype on a character (TICKET-ARC-01)`, and end to end through the panel in `ArchetypesConfigPanel.test.tsx` → `should refuse to delete an archetype a character is built on`.)
- [x] Components compose `ui/` primitives, theme tokens only. (`ArchetypeCard` and `ArchetypeFormDialog` compose `Button`/`Card`/`Dialog`/`FormField`/`Select`/`Text`; the panel uses `ConfigPanelShell` like the other ten. `yarn run check` clean, no raw hex, no stock palette.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions` skill. (See the Verification section below. `fallow audit` found a two-group clone family between the new dialog and `RaceFormDialog`; extracted rather than accepted — see implementation note 4.)
- [ ] Verified live in the browser: create an archetype, tag affinities. (**Left open — the User declined the live check for this run and the remaining v2 tickets**, asked and answered 2026-08-16.)

## Implementation notes

1. **No `SUPPORTED_SCHEMA_VERSION` bump, deliberately.** RACE-01 established "bump on every reshape",
   and its stated reason is that a build must not *crash on a field that moved*. Nothing moves here:
   `archetypes?` and `Character.archetypeId?` are purely additive optional fields, so a ruleset
   written before them reads as having none and a build without them ignores the key. Refining the
   rule rather than breaking it: **bump when a field moves or is removed; a purely additive optional
   field is readable by both builds.** ARC-02 and ARC-03 will bump if they move anything.
2. **`Character.archetypeId?` lands here rather than in ARC-03**, which is a small widening of this
   ticket's to-be. Without it nothing *can* hold an archetype, so `deleteArchetype`'s guard would
   return an empty list on every ruleset and criterion 4 would be untestable — an unfalsifiable
   green box. ARC-03 still owns setting it (the wizard step); ARC-02 owns making it change a number.
3. **`statAffinity` is stored sparsely, and `non` is absence.** A stored `non` would read as a
   reference and make `deleteStat` refuse for every stat every archetype had ever been saved over —
   the same trap RACE-01 avoided by pruning zeros from a stat block. Concept 03's "unassigned
   defaults to `non`" is therefore not a fallback bolted on top; it *is* the storage model.
4. **`StatRowsField` extracted to `config/shared/`.** `fallow audit` attributed a two-group,
   49-line clone family to the new dialog against `RaceFormDialog`. Both are the same idea — the
   ruleset's stats decide the rows, so there is no add/remove control — so the block is shared with
   the control passed as a render prop, the DX-05 precedent applied at field scale rather than
   accepting a copy.
5. **The point-buy column check treats `non` as always in use.** Any ruleset with stats and
   archetypes needs a `non` column, because a stat added later defaults to it — checking only the
   affinities literally present in the records would pass a ruleset that breaks the moment a stat is
   added. Reported as an **error** rather than a warning: without the column ARC-02 has nothing to
   look a spent point up in.
6. **Reachable from both places a config area is reached from.** The to-be's "domain shape +
   dashboard card" is `CONFIG_SECTIONS` in `useConfigDashboard.ts` (nine areas → ten) and
   `CONFIG_NAV` in `AppShell.tsx`. The dashboard's link test was widened from a stale hard-coded
   eight to the real list, which also picked up Curves — missing since CRV-03.
7. **The default-to-non report is a `warning`, not `information`.** SKL-03 introduced the third
   severity for an observation that is not a defect; this is not that. An untagged stat silently
   changes what a point buys, which is a thing that can be wrong — unlike the weight-sum balance
   rule, which merely differs from the sheet's habit.

## Conventions review — findings and what was done

The `conventions-reviewer` ran on the diff before it was committed and found eight things. All eight
are fixed in the same commit.

1. **`deleteStat` did not see an archetype's affinities — a real bug, and one this ticket's own
   comments claimed was already handled.** `findReferences` gained the `'archetype'` *target* case
   but nothing was added to `statReferences`, so deleting a stat would silently orphan every
   archetype tagging it — and `validateConfiguration` would then report the dangling key as a hard
   error, a state the store was free to create with no refusal. `archetypeAffinityReferences` now
   sits beside `raceStatBlockReferences` in the walker. **The two use opposite presence rules and
   both are right**: a race's block is dense with a neutral zero, so a zero is not a reference; a
   tagging is sparse with a neutral absence, so a present key *is* one. Covered by two new cases in
   `dependencies.test.ts`.
2. **`StatRowsField` shipped without a colocated test**, despite being newly load-bearing for two
   features. `StatRowsField.test.tsx` added — the row-per-stat ordering, the empty state, and the
   `idPrefix`→`htmlFor` association both panel tests depend on.
3. **`config/shared/index.ts` was missing the new component.** Added, along with the three that had
   drifted out of that barrel before this ticket (`ConfigEmptyState`, `ConfigPanelShell`,
   `UsageList`) — a barrel is kept complete or it is not a barrel.
4. **`'point_buy'` was written in two layers** — the engine's check and the store's seed — so
   renaming the seeded curve would have silently disabled the new validation rule. Moved to
   `POINT_BUY_CURVE_NAME` in `types/config.ts`, the same move `DEFAULT_STAT_AFFINITY` got and for
   the same reason: the engine cannot import the store, and this is a property of the stored shape.
5. **A ruleset with archetypes and *no* `point_buy` curve reported nothing** — strictly worse than
   one missing a single column, and it was the quiet case. Now its own error.
6. `Requirement 19.4` → `Requirements 19.4` in the route header, matching the other 122 modules the
   `spec-navigator` greps.
7. `ArchetypeCardProps` and `ArchetypeFormDialogProps` exported, so the diff is internally
   consistent with `StatRowsFieldProps`. (The race components it was modelled on still do not; that
   is theirs to fix.)
8. `ArchetypesConfigPanel.test.tsx` now resets `useCharacterStore` in `beforeEach` — the
   guarded-delete case wrote a character into module state that nothing cleared.

## Sheet data

[`docs/imports/archetypes.json`](../../imports/archetypes.json) is new: the six archetypes the
sheet's picker offers, descriptions verbatim. Marked `confidence: partial` because **only the main
stat is provable** — Concept 03 infers it from the Calculator's live 0.75 multipliers and flags the
sub/non split across the other nine stats as its own open question 🔍. Nothing is invented to fill
it: every stat but the main one is left absent, which the app reads as `non`. That means each
imported archetype trips the default-to-non warning by design, which is the honest state — the User
is the one who confirms the matrix from the live Calculator tab. `OPTIONAL_ARRAYS` in
`scripts/build-sheet-import.mjs` grew `archetypes`; `yarn run sheet:import` rerun.

## Verification

- `npx vitest run` — see the run recorded in [TEST_STATUS.md](../../../TEST_STATUS.md).
- `npx tsc --noEmit` — the documented 2-error baseline, unchanged.
- `yarn run check` — clean.
- `fallow audit` — no dead code, no new complexity; the one clone family it attributed to this diff
  is extracted (note 4), leaving only the generated route tree and a pre-existing pair in
  `importExport.ts`.

## Notes

- Seed archetypes (Strong/Sneaky/Smart/Wise/Tanky/Funny) come with the sheet import; a fresh
  config seeds none.
- `starting_bonus`, `skill_affinity`, `unlock_condition` deferred (the last needs boolean
  formulas).
