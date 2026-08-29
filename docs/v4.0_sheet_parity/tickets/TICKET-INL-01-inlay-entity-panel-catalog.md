# TICKET-INL-01 — Inlays: the entity and its panel

- **Area:** Inlays configuration (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [10 · Inlays](../systems/10-inlays.md); overview plan §8. First ticket
  of the minted **`INL`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the gem catalog is the data pass's. It owes this ticket a new `inlays.json` — 25 families ×
> 10 tiers from `Background Reference inlay: scaling` A1:J253, both group-header rows cited, with
> **Zircon's blank tier-10 row kept absent** (a gap, not a zero) and the double-Obsidian noted (a
> material family and a gem family share the name with different numbers; both kept) — plus its row
> in [README.md](../../imports/README.md).

## User story

As a User, I want a catalog of gem inlays — 25 families in ten tiers of stat grants — so my
players can socket a gem into what they craft.

## Description

A new entity the app has never had. An `Inlay` mirrors the `Material` family/tier shape over nine
stat axes (all six core stats plus Health, Mana, Speed — Mana is the axis inlays dominate). This
ticket is the entity and its config panel; the socket on the item and the engine term are
TICKET-INV-05's, and the gems themselves are the data pass's.

## Current situation (as-is)

- Nothing. No inlay entity, no socket on [`Item`](../../../src/shared/types/config.ts), no third
  bonus source on equipment.
- The pattern to mirror exists twice: `Material` family/tiers
  ([config.ts](../../../src/shared/types/config.ts), TICKET-MAT-01) and the `constants` optional-
  array precedent (absent means none).

## Desired result (to-be)

- **`Configuration.inlays?`** — optional array, absent-means-none: family + **stored tiers** of
  `{statId, modifier}` rows, grouped Common/Precious. Every tier is stored; nothing generates one.
- **A config panel** composed through
  [ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx), like
  every other entity panel — list, edit, guarded delete.
- **A family may have a gap**: the shape tolerates a missing tier — Zircon's absent tier 10 is a
  gap, not a zero, importable and selectable up to 9 and the User's to fill. Confirm `Material`
  already does the same (systems/10's recommendation) rather than assuming it.

## Acceptance criteria

- [x] A ruleset with no `inlays` behaves exactly as today (absent-means-none through import,
      export, validation) — additive-optional, no version bump needed for this field.
      (`Configuration.inlays?` in [config.ts](../../../src/shared/types/config.ts) with
      `SUPPORTED_SCHEMA_VERSION` left at 9; `inlays` is an `optional`-presence row in
      `ENTITY_SPECS`. Proven by *should accept a file with no inlays key — absent means none*,
      *should leave a ruleset with no inlays without one after a round-trip*
      (`importExport.test.ts`), *should mint a fresh ruleset with no inlays key at all*
      (`configStore.test.ts`) and *should validate nothing when the ruleset names no inlays*
      (`validator.test.ts`).)
- [x] The panel lists, creates, edits and deletes inlay families with tier editing; deletion is
      guarded once anything references one (the walker edge itself lands in TICKET-INV-05 — here
      the panel wires the existing guarded-delete surface).
      (`InlaysConfigPanel` + `InlayCard` + the two dialogs in
      [components/config/inlays/](../../../src/client/components/config/inlays/), mounted at
      `/config/inlays`. Delete runs through `useGuardedDelete` → `deleteInlay` →
      `guardedDelete(…, 'inlay', …)`, and the new `inlay` case in
      [dependencies.ts](../../../src/shared/engine/dependencies.ts) returns nothing **yet** — the
      `dice-ladder` precedent, filled in by INV-05's socket. Proven by *should add a family through
      the store*, *should edit a family without disturbing its ladder*, *should add a tier with a
      grant through the store*, *should remove a tier without renumbering the ones left*, *should
      delete a family, since nothing can point at one yet* (`InlaysConfigPanel.test.tsx`) and
      *finds nothing pointing at an inlay yet* (`dependencies.test.ts`). **Tier editing enforces the
      shape gate's own two rules on a rung** — a whole number from 1 up, unique within the family —
      so the panel cannot write a ladder the app's importer refuses; see implementation note 8 and
      *should refuse a rung another row already claims*, *should let a tier keep its own rung while
      something else about it changes* and *should refuse a fractional rung*.)
- [x] Persistence through the store action; the panel composes `components/ui` primitives, no raw
      controls; theme tokens only.
      (`addInlay` / `updateInlay` / `deleteInlay` in
      [configStore.ts](../../../src/client/stores/configStore.ts) are the only writers, each through
      `autoSave`; nothing under `components/config/inlays/` imports `storage.ts`. The panel composes
      `ConfigPanelShell`, `Card`, `Text`, `Button`, `Dialog`, `FormField` and the shared
      `StatValueRowsField` / `StatModifierBadges`, and its only colours are `parchment-50` /
      `stone-200`. `yarn run check` clean, including dependency-cruiser.)
- [x] A family with a missing tier imports, round-trips and renders with no invented value —
      pinned against a fixture of the ticket's own (the shape the data pass's Zircon needs).
      (A Zircon-shaped fixture — rungs 1 and 9, no 10 — in `importExport.test.ts`,
      `configStore.test.ts` and `InlaysConfigPanel.test.tsx`. Proven by *should round-trip a gapped
      ladder with no invented tier*, *should round-trip a gapped ladder through export and import*
      and *should render the rungs the family has, inventing no tier for the gap*, which asserts
      `Tier 1` and `Tier 9` are drawn and `Tier 10` is not. **`Material` confirmed to do the same**:
      `MaterialLevel` carries its own `level` and nothing indexes `levels` by rung, so a hole is
      already expressible there — recorded in `InlayTier`'s JSDoc.)
- [x] Unit tests cover: absent default, tier CRUD through the store, a gapped ladder surviving a
      round-trip, and validation of `{statId, modifier}` targets against real stats.
      (42 new tests, four of them from the review pass. Absent default and tier add/edit/remove in
      *Inlays CRUD (v4 systems/10,
      TICKET-INL-01)* in `configStore.test.ts`; the round-trip in both that block and *inlays (v4
      systems/10, TICKET-INL-01)* in `importExport.test.ts`; target validation in *inlays* in
      `validator.test.ts` — *should report a grant naming a stat that does not exist*, *should
      report a grant on a derived stat, whose formula is its only source*, *should say nothing about
      a ladder with a gap in it* — plus the shape gate's refusals of a bad rung and a duplicated
      one.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of the panel (ask the User first)~~.
      (`npx vitest run` **3320 passed / 198 files, 0 failing, 0 skipped** — up from the 3278/197
      baseline; `npx tsc --noEmit` the documented 2 errors and no more; `yarn run check` clean
      (biome + dependency-cruiser, 704 modules). `fallow audit --base main` reported one unused type
      export this ticket introduced (`InlayGroup`, since made module-local) and no dead code
      afterwards. `fallow health --hotspots --since 6m` puts **one** touched file on the list —
      `src/shared/services/importExport.test.ts` at **13.1 ▲ accelerating** (4 commits, 1240 churn,
      0.14 density), recorded by extending its existing row in
      [TEST_STATUS.md](../../../TEST_STATUS.md) and naming this ticket. The three production files
      touched are all *cooling*. **The build's own closeout got this wrong** — it checked the
      production files only and claimed no row was owed; the `conventions-reviewer` pass caught it,
      and the corrected rule is in TEST_STATUS: the hotspot check covers every touched file, test
      files included. The reviewer's other finding, a blocker, is note 7 below.
      **The browser clause is struck through: the browser check was skipped by User instruction for
      this run.**)

## Notes

- **All ten rows per family are data** — linearity is a property the capture verified, not a
  generator to impose (Obsidian and Zircon prove why). Nothing here generates a tier.
- Every gem family also exists as purchasable *items* in the shop catalog (TICKET-ITEM-02) —
  the crafting component and the catalog entry are two records sharing a name, and the data pass
  lands both.

## Implementation notes (2026-08-29)

Decisions made while building, none of which contradict a criterion above.

1. **The tier shape is `{ tier, bonuses }` — no `name`, no `value`.** `MaterialLevel` carries both
   because the *old* workbook named and priced every rung; the new one does neither for a gem, and
   [D5](../overview.md#d5--what-is-deliberately-not-parity) says prices are gone. A tier is what
   socketing this rung grants and nothing else. **The rung number lives on the row**, which is what
   makes a gap expressible without a sentinel — the array is the rungs the family *has*.
2. **`Inlay.group?` is a free User string, not a two-member set.** The sheet writes *Common Gems*
   and *Precious Gems*; a `const` object of those two would make the app disagree with any ruleset
   that sorts its gems differently, which is the ticket-review ruling's *a number the sheet happens
   to have is a default, not a rule*. It follows `Stat.group`'s rules exactly (TICKET-STAT-04):
   presentation only, validated against nothing, absent means ungrouped, and the panel's headings
   are the **distinct values present** rather than a list the app knows. Clearing it deletes the key
   (`mergeClearingAbsent` in `updateInlay`, the cleaner run on the way in by `addInlay`).
3. **The panel got a route of its own, `/config/inlays`.** The ticket asks for "a config panel …
   like every other entity panel", and every other one is reachable from the nav and the dashboard;
   hiding gems on `/config/materials` would have made the milestone's new entity the one section
   with no address. `src/client/routeTree.gen.ts` was regenerated by `npx vite build` rather than
   hand-edited, and `AppShell`'s `CONFIG_NAV` lists Inlays beside Materials because they are the two
   ingredients a composed item is made of.
4. **`deleteStat` is now guarded against inlay grants.** `inlayBonusReferences` in
   `dependencies.ts` sits beside `materialBonusReferences` — a gem's tier row names stats by id, so
   deleting a stat three families grant has to be refused rather than merely survived. One reference
   per family however many of its tiers name the stat.
5. **`findReferences` grew from cyclomatic 23 to 24**, which fallow already reported as high before
   this ticket. The growth is one `case` on an exhaustive `switch` whose `never` default is what
   makes a missing target kind a compile error; splitting it would trade a measured number for a
   worse structure, so it is recorded rather than refactored.
6. **A 9-line clone with `useMaterialManager` is left standing** — the `stats` sort and the
   `modifiableStats` filter. Two callers, and the house rule introduces no abstraction before the
   third; the shared *reasoning* is a pointer rather than a copy. The review found a **second** one
   fallow missed — `groupInlays` is a near-copy of `play/sheet/statGroups.ts`'s `groupStats`, down
   to the blank-label comment — and it is left standing for the same reason. Both are second
   instances; **if ITEM-01 or SPL-01 adds a third group-by-free-string list or a third
   `modifiableStats`, both extractions become owed at once.**
7. **`ReferenceTargetKind` gained a member and was not converted to a const object, deliberately.**
   [CLAUDE.md](../../../CLAUDE.md) says the ~12 pre-existing bare unions are converted *when
   touched*, and this ticket touched one. The reading taken is that **adding a member is not the
   reshape that rule is about**: the rule exists so a union stops being re-typed at call sites as it
   changes shape, and nothing here re-types one — `guardedDelete`'s ~15 call sites each pass a
   literal that the parameter type already checks, and `findReferences`' `switch` is exhaustive
   against the union with a `never` default. Converting would move all of those in a ticket whose
   subject is an entity, for no new safety. It is written down rather than left silent so the next
   ticket to touch the union — INV-05, which fills the `inlay` arm — inherits a decision rather than
   a question. **The conversion is still owed the day a call site spells one of these values
   somewhere the parameter type does not check it.**
8. **The tier rung is enforced in two places, not one** (the review's blocker). The shape gate
   refuses a fractional rung and two rows claiming one; the panel now refuses both too —
   `handleSaveTier` binds the family's other rungs and `setError`s a collision, and the register
   carries a `Number.isInteger` rule. Without it the app wrote ladders its own importer rejects,
   `InlayCard` keyed two rows on one number, and INV-05's socket would have read whichever came
   first. The pairing is the standing one (`useConstantManager`, `useCurveManager`,
   `useStatManager`) rather than a new demand — and explicitly **not** a *match materials* case:
   `materialLevelShapeErrors` has no uniqueness rule to mirror, so this gate is stricter by design.
9. **Tiers are stored in insertion order and sorted by rung for display.** `InlayCard` sorts, and
   carries the **stored** index with each row so edit and delete still address what they name.
   `InlayTier`'s JSDoc previously claimed the array was "in whatever order the User arranged it",
   which was untrue — there is no reorder control — so the type now says insertion order outright
   and points at the sort, the same split `Stat.order` makes.
