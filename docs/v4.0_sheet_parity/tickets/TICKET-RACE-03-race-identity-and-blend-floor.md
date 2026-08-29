# TICKET-RACE-03 — Race identity fields and the blend floor

- **Area:** Races configuration
- **Type:** Feature (shape + one engine term)
- **Traceability:** System [04 · Races](../systems/04-races.md) (gaps 1, 3, 4, 5); system
  [14 · Reference tables](../systems/14-passives-and-reference-tables.md) (sizes and types).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the 25-race catalog is the data pass's. It owes this ticket
> [races.json](../../imports/races.json) re-sourced to `Background Referenes Race: scaling` (typo
> intact) — keep human/elf/Hamster/dwarf/Raccoon, drop the four bestiary rows, add the twenty new
> blocks, each with its type, size and challenge rate, plus the two reference lists this ticket's
> fields validate against.

## User story

As a User, I want a race to carry its creature type, size and challenge rate — and a blend that
never floors a stat to nothing — so the roster my table plays fits in the app before it is typed in.

## Description

Three shape changes and one engine term. `Race` gains the identity fields the old sheet never gave
it, the Configuration gains the two reference lists those fields are picked from, and
`calculateRaceStatBases` gains the sheet's `MAX(1, …)` floor. The count of races a character picks
is **TICKET-RACE-04**; which races exist is the data pass's.

## Current situation (as-is)

- [races.json](../../imports/races.json) holds ten races from the old sheet (TICKET-RACE-01/02).
  No type, size, or challenge-rate field exists on
  [`Race`](../../../src/shared/types/config.ts).
- `calculateRaceStatBases` in
  [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts) blends two blocks
  as `roundup((a + b) / race_blend_divisor)` — the xlsx's chain is the same arithmetic **except
  one new term: the `MAX(1, …)` floor**. A stat both races have at 0 reads 1 in the sheet, 0 in
  the app.
- The sheet's size and type vocabularies (Naming BD3:BE9, BG3:BH19) exist nowhere in the app.

## Desired result (to-be)

- **Identity fields**: optional `type?`, `size?`, `challengeRate?` on `Race`, additive-optional so
  a ruleset without them is unchanged.
- **Two reference lists on the `Configuration`** — sizes and creature types, optional and
  absent-means-none, holding free User strings (`humaniod` and `guargantian` are theirs to fix, not
  ours). A race's `type`/`size` validate against them as a **finding**, never a crash, and never a
  hard-coded const object; smallest shape wins (systems/14).
- **The blend floor**: `MAX(1, …)` added to `calculateRaceStatBases` beside the existing divisor —
  only all-zero pairings move, from 0 to 1.

## Implementation notes (2026-08-29, as built)

Three things the build settled that the criteria below did not say outright. They are recorded here
rather than folded silently into the ticks.

1. **The floor is spelled as "a blend that comes to nothing", not as a blanket `MAX(1, …)`.** The
   workbook's literal formula would also raise a **negative** pairing to 1. The sheet has no negative
   creature row to say what it means there, this app has always let a ruleset write one, and
   criterion 1 below asks for a non-zero blend to be *bit-for-bit* what it was. Since a blend can
   only land on 0 when the two blocks supply nothing (a positive sum rounds away from zero to at
   least 1, a negative to at most −1), the two readings differ **only** over negatives, and the
   narrower one is what shipped. `withBlendFloor` in
   [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts) carries the
   argument; widening it later is a decision, not a tidy-up.
2. **The floor reaches the stats the blocks mention, and no others.** A stat *neither* race names is
   not in the blend's key set, so it stays absent and reaches the composition as `?? 0` — and since
   TICKET-RACE-01 prunes zeros from a stored block, "both races have it at 0" is normally exactly
   that case. Flooring **every configured stat** means handing `calculateRaceStatBases` the ruleset's
   stat list, which changes what four call sites display; that is a reshape of what a blend *is*
   rather than one engine term, and it belongs beside TICKET-RACE-04 rather than here.
3. **The reference lists are `string[]`, deliberately** (the to-be's *smallest shape wins*). The
   sheet pairs each size and type with a one-line gloss (`tiny` "¼ square", `humaniod` "Generic");
   those glosses have **no home in this shape** and are the data pass's to record in its fragment
   `notes`. Giving each entry `{ id, name, description }` would make a reference list a third
   guarded-delete entity for prose nothing reads.

## Acceptance criteria

- [x] The floor is pinned: an all-zero pairing reads 1, a non-zero blend is bit-for-bit what it was
      before — `statCalculator` tests on both sides, against fixtures of the ticket's own.
      (`withBlendFloor` + `RACE_BLEND_FLOOR` in
      [statCalculator.ts](../../../src/shared/engine/calculators/statCalculator.ts); five cases in
      `statCalculator.test.ts` under *the sheet's MAX(1, …) floor* — an explicit-zero pair reading 1,
      a cancelling pair reading 1, a single race's explicit zero floored so *picking the same race
      twice still changes nothing*, a stat neither block mentions staying out of the map, and
      *should leave every non-zero blend bit-for-bit what it was* covering the average, the negative
      pair and the half-block. Note 1 above records where this parts company with the workbook's
      literal spelling; `calculator.test.ts`'s three re-valued expectations are the floor firing on
      the pre-existing elf/human fixture.)
- [x] A race's type/size validate against the Configuration's reference lists (validation finding,
      not a crash, when they don't); a ruleset with no lists validates nothing and stays valid.
      (`raceIdentityIssues` in [validator.ts](../../../src/shared/engine/validator.ts), a `warning`
      that leaves `isValid` true; six cases in `validator.test.ts` under *creature identity against
      the reference lists* — the match, each field's mismatch, both at once, and the three silences:
      no lists, an empty list, and a race stating no identity.)
- [x] `challengeRate` is stored and **built on nothing** — no engine, no display logic beyond the
      config panel; a grep proves the field has exactly one reader.
      (The grep is a test:
      [challengeRate.test.ts](../../../src/client/components/config/races/challengeRate.test.ts)
      scans every non-test module under `src/` and asserts the readers are exactly the declaration,
      the import shape gate, `useRaceManager` and `RaceFormDialog` — nothing in `shared/engine/`,
      `components/play/` or `src/server/`. A second case fails the scan if the corpus ever comes back
      empty. The race **card** deliberately does not show it, which
      `RacesConfigPanel.test.tsx`'s *should show the identity a race states on its card, and never
      the challenge rate* pins.)
- [x] The config panel edits all three fields and both reference lists, composing
      `components/ui` primitives through `ConfigPanelShell`; persistence through the store action.
      (`ReferenceListEditor` in the shell's `headerExtra` — `Button`/`Input`/`Label`/`Text`, no raw
      elements, no new shell prop; the three identity controls in `RaceFormDialog` as two `Select`s
      and an `Input`. Persistence is `configStore.setCreatureSizes` / `setCreatureTypes` and the
      existing `addRace`/`updateRace`; no component touches storage. Six panel cases plus five store
      cases in `configStore.test.ts`.)
- [x] Derived values still come from the engine; the blend has exactly one home.
      (`calculateRaceStatBases` is still the only implementation and still the only caller of the
      floor — grep for `withBlendFloor` returns one module. Nothing was added to `Character`, and the
      three new fields are ruleset data that nothing derives from.)
- [x] Additive-optional throughout — a v3-shape ruleset round-trips import/export unchanged, so no
      version bump of its own.
      (`SUPPORTED_SCHEMA_VERSION` is untouched at 9. `importExport.test.ts`'s *should round-trip a
      v3-shape ruleset unchanged* asserts the races come back byte-equal **and** that neither
      `type` nor `creatureSizes` nor `creatureTypes` grew as a key. An emptied list is stored as
      absence rather than `[]` — `emptyToAbsent` in `configStore.ts`, pinned by *should spell an
      emptied list as absence*.)
- [x] Unit tests cover: the floor, an unchanged non-zero blend, reference-list validation both ways,
      and the fields' round-trip through import/export.
      (All four, per the criteria above: 5 + 6 + 6 tests, plus 5 store and 6 panel cases and the
      2-case grep — **+30 tests, 194 → 195 files**, recorded in
      [TEST_STATUS.md](../../../TEST_STATUS.md).)
- [ ] ~~Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus~~ **a live browser check of the race panel (ask the User first)**.
      Verification done and clean: `npx vitest run` **3166 passing / 195 files / 0 failing /
      0 skipped**, `npx tsc --noEmit` at the documented 2-error baseline, `yarn run check` (Biome +
      dependency-cruiser) clean, `fallow audit --base main` **pass** with
      `complexity_introduced: 0` / `dead_code_introduced: 0` / `duplication_introduced: 0`,
      `fallow dead-code` finding nothing this ticket added, and `fallow health --hotspots --since 6m`
      showing no touched file Accelerating. Written against the `coding-conventions` skill throughout.
      **The box stays open for the browser half only: browser check skipped by User instruction for
      this run.** A `conventions-reviewer` pass on the diff is the caller's next step.

## Notes

- **Challenge rate is 0 for every playable race** — a creature-facing field waiting for a bestiary.
  Store it because the sheet has it; build nothing on it (systems/04's open question).
- The race *count* and the `Empty` placeholder are **TICKET-RACE-04** — kept separate because that
  one touches character creation and the allocation path (the overview's "§4 is no longer a
  data-only line" warning), while this one is fields plus one engine term.
- The reference lists are the first two of their kind. If a third list wants the same treatment
  later, that is when a shared shape earns itself — not now (the third-caller rule).
- **What the data pass inherits from implementation note 3**: the lists are `string[]`, so the
  sheet's per-entry glosses (`tiny` "¼ square", `humaniod` "Generic", and the rest of Naming
  BD3:BE9 / BG3:BH19) have nowhere to land in the shape. Record them in the fragment's `notes`,
  citing the ranges, rather than inventing a field for them.
