# TICKET-SPL-01 — Spells: the entity and its panel

- **Area:** Spells configuration (new area)
- **Type:** Feature (new entity)
- **Traceability:** System [13 · Spells](../systems/13-spells.md) (gap 1); overview plan §11.
  First ticket of the minted **`SPL`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> the compendium is the data pass's. It owes this ticket a new `spells.json` — all 418 rows from
> `background calculations spells ` A8:E428 (B name · C mana · D range/time · E effect), anomalies
> recorded as-is: `mighty fortress`'s swapped columns kept swapped, `Summon Lesser Demons`'s
> `#VERW!` effect imported as an **empty template with a note** (never invented text), the mana
> outliers, the six blank range cells, and row 10's `empty`/0/`0f`/0 template row skipped as
> capture metadata — plus its row in [README.md](../../imports/README.md).

## User story

As a User, I want my ruleset to carry a spell compendium — name, mana cost, range/time and effect
text per spell, and a panel that stays usable at four hundred of them — so the spells the table
plays have somewhere to live.

## Description

The `Spell` entity and its Configuration-mode panel — a panel that has to stay usable at four
hundred rows, which is the only thing about spells that is harder than any other entity. Effect
text is stored raw; template semantics arrive in TICKET-SPL-03, learned tracking and casting in
TICKET-SPL-02, and the 418 spells themselves in the data pass.

## Current situation (as-is)

- Nothing — Concept 13 (Spell) was always a later-milestone entity. Mana already exists as a
  resource pool (`isResource`, `currentResourceValues`), which is the whole casting economy this
  will need.
- The optional-array precedent (`constants`, TICKET-CST-01) and the panel pattern
  ([ConfigPanelShell](../../../src/client/components/config/shared/ConfigPanelShell.tsx)) are
  established.

## Desired result (to-be)

- **`Configuration.spells?`** — optional array, absent-means-none:
  ~~`{ id, name, description?, manaCost, rangeTime, effectTemplate }`~~ **`{ id, name,
  description?, manaCost?, rangeTime, effectTemplate }`** (amended 2026-08-29 while building — see
  implementation note 1: `mighty fortress`'s swapped columns leave one row with no readable cost,
  and a required `number` would force inventing one). `rangeTime` is free text
  (the sheet's spellings are wildly inconsistent and normalising them is the User's edit);
  `effectTemplate` holds the effect text, template semantics arriving in SPL-03.
- **A config panel** through `ConfigPanelShell` — list, create, edit, guarded delete — with the
  **search or paging** four hundred rows need, built from the shell's existing patterns rather than
  a bespoke list.
- **An empty effect is legal**: a spell whose effect text is absent imports, renders and edits
  without complaint — the shape the data pass's `#VERW!` row lands in.

## Acceptance criteria

- [x] A ruleset with no `spells` behaves exactly as today — additive-optional, no version bump
      needed for this field.
      (`Configuration.spells?` in [config.ts](../../../src/shared/types/config.ts) with
      `SUPPORTED_SCHEMA_VERSION` left at 10 — v4.0's one bump, spent at TICKET-INV-05; `spells` is an
      `optional`-presence row in `ENTITY_SPECS` with no `custom` checker. Proven by *should accept a
      file with no spells key — absent means none* and *should leave a ruleset with no spells without
      one after a round-trip* (`importExport.spells.test.ts`), *should mint a fresh ruleset with no
      spells key at all* (`configStore.test.ts`) and *should validate nothing when the ruleset names
      no spells* (`validator.test.ts`). The two exhaustive-collection loops in
      `importExport.test.ts` now name `spells` (and `inlays`, which they had been missing).)
- [x] The panel lists 400+ spells usably — search or paging, proven against a generated fixture at
      that scale, not against four rows — edits through the store action, and delete is guarded
      once anything references a spell (the edge lands with SPL-02's `learnedSpellIds`; the panel
      wires the existing surface).
      (`SpellsConfigPanel` + `SpellCard` + `SpellFormDialog` + `useSpellManager` in
      [components/config/spells/](../../../src/client/components/config/spells/), mounted at
      `/config/spells`. **Both**, not one: a name search over the whole compendium *then* a 25-row
      page, so the header counts the match rather than the page. The scale cases run against
      `compendium(418)` — *should draw one page rather than four hundred cards* (`Showing 1–25 of
      418`, `Page 1 of 17`, and `Spell 417` **not** in the DOM), *should page forward and back*,
      *should stop at both ends of the pager*, *should find one spell out of four hundred by name*,
      *should count the whole match rather than the page in front of you* (111 of 418), *should send
      a narrowed list back to its first page* and *should say a search matched nothing rather than
      that the compendium is empty*. Delete runs through `useGuardedDelete` → `deleteSpell` →
      `guardedDelete(…, 'spell', …)`, and the new `spell` arm in
      [dependencies.ts](../../../src/shared/engine/dependencies.ts) returns nothing **yet** — the
      `dice-ladder` and `inlay` precedent. Proven by *should delete a spell, since nothing can point
      at one yet* (panel and store) and *finds nothing pointing at a spell yet*
      (`dependencies.test.ts`). `referenceArms.test.ts` carries a **vacuous row for
      `learnedSpellIds`** so SPL-02 cannot ship the field with the arm still empty.)
- [x] A spell with an empty effect and a spell with free-text `rangeTime` both round-trip
      import/export untouched — nothing normalises either.
      (*should round-trip a spell with an empty effect and an empty range, normalising neither*,
      *should round-trip a free-text range verbatim, however the ruleset words it* — eight of the
      workbook's own spellings, `60f` through `/` — *should round-trip a spell the ruleset does not
      price, growing no cost*, *should keep a mana cost of 0, which a falsy check would erase* and
      *should carry effect text through untouched, since nothing parses it yet*
      (`importExport.spells.test.ts`), plus *should keep an empty range and an empty effect exactly
      as given* and *should round-trip an unpriced spell through export and import*
      (`configStore.test.ts`). `useSpellManager.handleSaveSpell` trims neither field, and
      `SpellCard` renders the absence as *Not stated* / *No effect text.* rather than as a zero.)
- [x] Feature components compose `components/ui` primitives; persistence through the store
      action; theme tokens only.
      (`addSpell` / `updateSpell` / `deleteSpell` in
      [configStore.ts](../../../src/client/stores/configStore.ts) are the only writers, each through
      `autoSave`; nothing under `components/config/spells/` imports `storage.ts`. The panel composes
      `ConfigPanelShell`, `Card`, `Text`, `Button`, `Dialog`, `FormField`, `Label` and `Textarea`,
      with no raw control, and its only colours are the theme's own — `parchment-*`, `ink-*`,
      `stone-*`, `crimson`. `yarn run check` clean, including dependency-cruiser over 727 modules.)
- [x] Unit tests cover: absent default, CRUD through the store, the empty-effect case, and the
      round-trip.
      (48 new tests. Absent default and full CRUD in *Spells CRUD (v4 systems/13, TICKET-SPL-01)* in
      `configStore.test.ts` (8); the wire in `importExport.spells.test.ts` (14), including the
      418-row *should carry a compendium at the sheet's own scale through the round trip*; the panel
      in `SpellsConfigPanel.test.tsx` (16); the referential half in *spells (v4 systems/13,
      TICKET-SPL-01)* in `validator.test.ts` (5) — nothing reported for a spell that points at
      nothing, nothing for the three absences, nothing for two spells sharing a **name**, and an
      error for two sharing an **id**. Plus `dependencies.test.ts` (1), `referenceArms.test.ts` (+3)
      and `configRoutes.test.tsx` (1). **The panel cannot write a document its own importer
      refuses** — *should store nothing for a cost the User leaves blank, rather than a NaN its own
      import refuses* pairs with *should reject a cost that is present and not a finite number*.)
- [x] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, ~~plus a live browser check of the panel over a large fixture (ask the User first)~~.
      (`npx vitest run` **3496 passed / 213 files, 0 failing, 0 skipped** — up from the 3448/201
      baseline; `npx tsc --noEmit` the documented 2 errors and no more; `yarn run check` clean.
      `fallow audit --base main` reports **no issues in 34 changed files** — `dead code 0 ·
      complexity 0 · duplication 0` introduced, the four complexity findings and the one dead-code
      row all inherited and excluded by the gate. `fallow dead-code` reports only the two standing
      inherited rows (`RulesetHomeKind`, the `fallow` dependency). **`findReferences` has left the
      high-complexity list entirely** — 24 cyclomatic to 1, which is obligation 2 below.
      `fallow health --hotspots --since 6m` puts **seven** touched files on the Accelerating list;
      six have rows in [TEST_STATUS.md](../../../TEST_STATUS.md) and are updated, and
      `shared/engine/validator.ts` gets a first one.
      **The browser clause is struck through: the browser check was skipped by User instruction for
      this run**, so a four-hundred-row page has not been seen live.)

## Notes

- The per-player `locked/Learned` column is character state, not ruleset data (overview D5) —
  it lands in SPL-02.
- `rangeTime` is free text on purpose: the sheet's spellings are wildly inconsistent and
  normalising them is the User's edit, not the importer's.

## Implementation notes (2026-08-29)

Decisions made while building. The first amends the to-be above; the rest do not contradict a
criterion.

1. **`manaCost` is optional, which the to-be wrote as required.** The Scope line owes the data pass
   `mighty fortress`'s **swapped columns kept swapped** — its mana cell reads `1 Mile` and its range
   cell reads `270` — and a required `manaCost: number` makes that row unstorable: the only ways out
   are inventing a cost or dropping the spell, and *never invent a number to fill a required field*
   is the compendium's own rule (`docs/imports/README.md`, v4 D1). So the field is optional and
   **absent means the ruleset does not price this spell**, with the anomaly living in the fragment's
   `notes`. It is exactly Zircon's blank tenth tier one entity over (TICKET-INL-01): a gap the shape
   can express rather than a zero it invents. **TICKET-SPL-02 owns what an unpriced spell costs to
   cast** — refuse, or cast free — and that is a decision, not a default to assume here.
2. **`rangeTime` and `effectTemplate` stayed required strings whose empty value is legal**, rather
   than becoming optional. The to-be's *an empty effect is legal* is satisfied by `''`, which is what
   the `#VERW!` row's "empty template with a note" means and what six blank range cells mean; making
   them optional would give absence two spellings (`undefined` and `''`) with nothing to tell them
   apart, and every reader a `??`. The gate accepts `''` and no writer trims either field.
3. **No `FormulaPreview`, and the effect box is a plain `Textarea`.** CLAUDE.md's standing rule is
   that every field a User types a **formula** into ships FORM-08's preview; effect text is not a
   formula field yet — [D4](../overview.md#d4--spell-effect-text-goes-through-the-formula-engine)
   puts the `spell-effect` attachment point in TICKET-SPL-03, and until `scoping.ts` has that row the
   engine cannot scope the expression, so a preview of it could only ever be wrong. The rule lands
   with the attachment point. Stated in `SpellFormDialog`'s own header so the next reader inherits
   the decision rather than the question.
4. **The panel got a route of its own, `/config/spells`**, in the nav after Rolls and on the
   dashboard — a spell is what a caster *does* rather than something carried, so it is not beside
   Items. `src/client/routeTree.gen.ts` was regenerated by `npx vite build`, never hand-edited.
5. **Search and paging, not one or the other.** The criterion offers either; both are needed and
   they answer different halves. Search alone still renders 418 cards for an empty query; paging
   alone makes finding *Zephyr Strike* a walk through seventeen pages. The pair is **filter then
   page**, which is what lets the header count the match rather than the page — and typing resets to
   page 1, since the page you were on stops meaning anything the moment the list narrows. The page
   index is **clamped on read** rather than merely stored, so deleting the last spell on the last
   page cannot strand the list on a page that no longer exists.
6. **`useSpellManager` holds the mana cost as *text*, not `valueAsNumber`.** This is the standing
   two-place rule — the shape gate for untrusted import, the hook's save path for User input — in the
   place TICKET-ITEM-01 identified it: a number box registered `valueAsNumber` yields `NaN` when
   cleared, which serialises as `null`, which `ENTITY_SPECS.spells` refuses. Without the guard the
   panel writes a ruleset the app's own importer turns away. It is `RaceFormData`'s optional-rate
   pattern, now at **two** instances; a third earns the extraction.
7. **No `groupByLabel` and no `modifiableStats` caller.** The INL-01 handoff warned this ticket might
   become the third caller of either and make both extractions owed at once. It is neither: a spell
   has no group field (the sheet does not sort its spells) and grants no stats. `groupByLabel` stays
   at three callers and `modifiableStats` at two.

## Obligations discharged (2026-08-29)

Two obligations earlier tickets assigned to **this** ticket by name, both in
[TEST_STATUS.md](../../../TEST_STATUS.md)'s hotspot table.

- **`importExport.test.ts` is split, per entity.** The row's rule was *the sixth per-entity describe
  splits the file*, and INV-06's handoff said a plan that did not open with it was the wrong plan.
  Eleven sibling files now exist — `importExport.{stats,races,materials,inlays,spells,items,
  equipment,rolls,archetypes,constants,curves}.test.ts` — mirroring `ENTITY_SPECS`, and the parent
  keeps the service's own contract at 460 lines instead of 1,522. Two rules keep it mechanical and
  are written into the parent's header: **a whole `describe` moves and a loose `it` does not**, and a
  field retired from an *entity* travels with that entity (INV-05's fused pair is in the items file
  now) while the configuration's own retirements stay put. No case changed; the split is a move.
- **`findReferences` is the `Record<Kind, walker>` it already read like.** The row's trigger was *a
  ticket that has to change `EntityReference`'s shape or the `ReferenceTargetKind` union*, and adding
  `spell` to the union is it. Every arm is a named module-level function taking `(id, config,
  characters)`; `REFERENCE_WALKERS` maps kind to function; `findReferences` is a lookup and a call.
  It measured **24 cyclomatic** with every arm inside it at one or two — the dispatcher was the file's
  whole complexity — and it is now off `fallow`'s high-complexity list entirely, taking the file's
  density from 0.19 to 0.16. **The exhaustiveness got stronger, not weaker**: a `Record` keyed by the
  union refuses both a missing key and an invented one, at the declaration, naming the key — where
  the `never` default caught only the first and only at the bottom of a function.
  `inlayReferenceArm.test.ts` read `case '<kind>':` bodies out of the source, so it moved with the
  dispatcher: it is `referenceArms.test.ts` now, reads the table for the kind's function and then
  that function's body, and is parameterised over two rows — `inlay`/`inlayId` (live) and
  `spell`/`learnedSpellIds` (vacuous, armed for SPL-02).
  **`ReferenceTargetKind` is deliberately still a bare union**, on INL-01 note 7's stated terms: the
  conversion is owed the day a call site spells one of these values somewhere the parameter type does
  not check it, and that day has not come — `guardedDelete`'s ~16 call sites each pass a literal the
  parameter type checks, and the table's keys are checked by the `Record`.

## Review pass (2026-08-29) — nothing blocking, four things taken

The `conventions-reviewer` **measured** both headline claims rather than accepting them, which is
what a *"this large diff changed nothing"* claim needs: the split was checked by `it(` counts
(116 → 116), by **byte-identical sorted test titles** across the old file and parent-plus-children,
and by **matching `expect(` counts per test title** — titles prove nothing was dropped, assertion
counts prove nothing was hollowed out. The dispatcher was checked arm by arm against HEAD, all
sixteen identical, with the `Record`'s two-directional exhaustiveness confirmed at the declaration.
The `inlays` coverage hole was re-derived against `git show HEAD` rather than believed.

Four things taken, none behavioural:

1. **`dependencies.ts`'s hotspot row said "▼ Cooled"** while fallow still tags the file
   `▲ accelerating`. The *score* fell (20.5 → 19.7); the *velocity tag* is churn-based and did not.
   The row now says so outright — a row claiming fallow cooled a file fallow calls accelerating is
   worse than no row.
2. **Three nested calls bound** — `referenceArms.test.ts`'s scan premise, `dependencies.test.ts`'s
   new case (where **every neighbouring case already binds `const found = findReferences(…)`**, so
   this was drift against a local habit rather than against the rule in the abstract), and
   `useSpellManager`'s `Math.max(1, Math.ceil(…))`. `importConfiguration(serializeConfiguration(…))`
   in `importExport.spells.test.ts` is **left**: it copies seven pre-existing instances, and that
   family converts together or not at all.
3. **The vacuous row's field name is a guess, and it is load-bearing** — see the handoff below,
   which now says so explicitly, as does `ARMS`' own doc.
4. **Five of the sixteen walker arms** carried inferred rather than declared return types, which is
   noise in a file whose whole point is a uniform table. Annotated.

`ReferenceTargetKind` staying a bare union was upheld **because it was deferred explicitly here**
rather than silently (implementation note in the obligations section above, on INL-01 note 7's
terms). A recorded deferral survives review; an unrecorded one reads as an oversight.

## Handoff to TICKET-SPL-02 (learned spells, the Spellbook, casting)

- **`Character.learnedSpellIds?: string[]` owes `dependencies.ts`'s `spell` arm a walk.**
  `referenceArms.test.ts`'s vacuous row goes live the moment `shared/types/character.ts` names the
  field, and it will fail until `spellReferences` reads it. Deleting a spell three Players have
  learned has to be refused, not survived — `characterFocusReferences` is the shape to copy.
  **The spelling is load-bearing.** That row is keyed to the string `learnedSpellIds`, which this
  ticket *guessed* from systems/13 rather than read off a type that exists. Name the field anything
  else — `knownSpellIds`, or a `spellbook: { spellId }[]` — and the row stays green **and vacuous**
  while the arm stays empty, which is precisely the failure the file exists to prevent. So either
  keep the spelling, or change `ARMS`' `field` (and its `live` flag) in the same commit that names
  the field. The check cannot notice a rename; only the ticket can.
- **`manaCost` may be absent**, and casting has to say what that means. Note 1 above leaves the
  decision open on purpose.
- **Case-insensitivity is the sheet's, not the app's.** systems/13 records that the workbook's
  Spellbook filter matches `learned` and `Learned` alike; that is a fact about transcribing the
  sheet, and a boolean membership list has no such problem — do not build a case-folding rule for it.
- **"Chosen abiltie" is built into nothing** (overview ruling) — do not wire it to `learnedSpellIds`.
- The Spellbook renders effect text **raw** until SPL-03 lands the attachment point.
