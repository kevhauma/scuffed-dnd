# TICKET-INV-05 — Composed items: the record and the engine

- **Area:** Inventory & equipment / engine
- **Type:** Feature (new player state + engine, one deletion)
- **Traceability:** System [12 · Item composition](../systems/12-item-composition-and-backpack.md)
  (gaps 1, 2); overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (composed
  items live in the Player's inventory, as links). **Needs TICKET-INV-04** (slots proven variable),
  **TICKET-INL-01 / TICKET-ITEM-01** (two of the three shapes a record links; `Material` is the
  third and already exists).

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> nothing seeded is this ticket's — it links shapes, and the shapes exist. The data pass owes it
> only the corpus the sample case needs (an Iron Ore ladder, a Diamond ladder, a Battleaxe
> template), at which point TICKET-DX-09's successor pins the end-to-end numbers.

## User story

As a Player, I want my "Iron Ore 10 Battleaxe with Diamond 4 inlay" to be one thing in my
inventory that knows its parts — so its stats and skill bonuses always reflect what those parts
currently say.

## Description

A carried thing is a triple: material tier + template + optional inlay tier. The record lives on
the **character** and stores *references*, never numbers — the derived-values rule, and the
reason retuning a material relabels every axe in the game instead of rewriting none of them.
`Item`'s v1 fused `materialId`/`materialLevel` fields — the fused-instance experiment — are
deleted here.

## Current situation (as-is)

- [`Item`](../../../src/shared/types/config.ts) *is* a fused instance — `materialId?` +
  `materialLevel?` on the template record (v1.0's reading of "iron 1 empty rapier") — and
  [`Inventory`](../../../src/shared/types/character.ts) holds
  `equippedItems: Record<slotType, itemId>` + `miscItems: itemId[]`.
- Equipment stat bonuses come from the item's material tier
  ([equipmentBonusCalculator.ts](../../../src/shared/engine/calculators/equipmentBonusCalculator.ts),
  TICKET-MAT-02); there is no inlay term and no skill-side contribution wiring to composed parts.
- [dependencies.ts](../../../src/shared/engine/dependencies.ts) already counts characters as
  references for guarded deletes — the mechanism this ticket extends with new edges.

## Desired result (to-be)

- **The composed record** — `{ id, templateId, materialId, materialLevel, inlayId?, inlayLevel? }`
  — in the character's inventory. Nothing about its bonuses is stored; `Inventory` grows a home
  for the records (a third collection keyed by id, or the existing two naming composed records —
  prefer the smaller change that keeps `equippedItems: Record<slotType, id>` intact). `Item`
  loses `materialId`/`materialLevel` outright — no conversion, per
  [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29).
- **The engine reads the parts at calculation time**: per equipped slot, stat bonuses = material
  row **+ inlay row** (Mana/Speed from the inlay table only — materials have no such columns);
  skill bonuses = the template's vector (TICKET-ITEM-01's term now fed by composition).
- **Guarded deletes reach further**: deleting a material, template or inlay a character has built
  something from is refused by the existing walker — a new edge in the same graph, not a new
  mechanism.

## Implementation note (2026-08-29) — the record's material link is **optional**

The to-be above writes the record as `{ id, templateId, materialId, materialLevel, inlayId?,
inlayLevel? }`, with only the inlay marked optional. **What shipped marks all four optional**, and
the divergence is deliberate:

- **`Item.materialId` and `Item.materialLevel` were already optional** on the template the record
  inherits them from, so keeping them optional *moves* the fields without also changing what a
  ruleset may say. Requiring them would make a plain rope — no metal in it, no tier to name —
  unrepresentable, and the corpus has such items today.
- **The field tolerates; the action insists.** That is `Character.focusSkillIds`' split exactly:
  three focus picks are optional on the type and required by `characterCreationErrors`. A material
  tier is optional here and is TICKET-INV-06's build action's to require, since that ticket owns the
  three-column picker that offers one.
- The alternative was for **this** ticket to build the builder — the pack has no other way to be
  filled — which is INV-06's whole scope.

`addToPack` therefore still takes a template id and mints a build naming no material and no inlay.
Every criterion below is unaffected: the arithmetic, the empty-inlay case and the guarded deletes all
read the links when they are there.

## Acceptance criteria

- [x] The composition reproduces end to end on a fixture shaped like the sample — a material tier
      plus an inlay tier plus a template vector in one hand slot → stats from material + inlay,
      skills from the template — engine test through `calculateCharacter`. The sample's own numbers
      (Str 18 / Con 18 / Char 8 / Health 5 / Mana 4000) pin once the data pass seeds the parts.
      (`shared/engine/calculators/equipmentBonusCalculator.test.ts` — *the inlay term* describe:
      *should add the material row and the inlay row together* reads Iron 1's `STR +2` plus Diamond
      1's `STR +4 / MANA +50` off one worn build; *should read the template's vector whatever the
      build is made of* pins the skill half on the same walk. End to end through `calculateCharacter`
      in `shared/engine/calculator.test.ts` — *should apply an equipment bonus to a main skill and
      propagate it into stat values* and the whole *an equipped templates skill vector* describe now
      run on composed records.)
- [x] Retuning a material tier moves every composed item made of it on the next read — nothing
      stored, pinned by a test that edits the tier and re-derives.
      (`equipmentBonusCalculator.test.ts` — *retuning a part › should move every build made of it, on
      the next read*: one character, two rulesets differing only in Iron's `STR` row, `4` before and
      `10` after.)
- [x] A composed record with no inlay contributes the material row alone (`inlayId?` absent is
      legal — the sheet's "with empty inlay").
      (`equipmentBonusCalculator.test.ts` — *should contribute the material row alone for the sheet's
      "with empty inlay"*, plus *should grant Mana only through the gem* which asserts the same
      absence from the other side.)
- [x] Deleting a referenced material/template/inlay is refused naming the characters holding it;
      an unreferenced one deletes — `dependencies` tests for each new edge.
      (`shared/engine/dependencies.ts` — the `item`, `material` and `inlay` arms all walk
      `composedItemReferences`. Six cases in `dependencies.test.ts`: one *finds* and one *finds
      nothing* per edge, plus *names a Player once however many builds of theirs point at the same
      part*.)
- [x] **The `inlay` arm of `findReferences` is filled, and a scan test makes forgetting it a
      failure.** TICKET-INL-01 shipped the `inlay` target kind returning `[]` deliberately (nothing
      could point at one yet), and the `switch`'s `never` default catches a **missing kind** but not
      a **new referrer to an existing kind** — so adding `inlayId` while leaving that arm empty
      compiles, passes, and silently orphans every socket. Close it the way
      [`components/config/races/challengeRate.test.ts`](../../../src/client/components/config/races/challengeRate.test.ts)
      closes its equivalent: a test that scans `src/` and **fails if `Item` (or the composed record)
      names an `inlayId` while the `inlay` arm still returns nothing**.
      (New file `src/shared/engine/inlayReferenceArm.test.ts`, three cases: the corpus check that
      keeps the scan falsifiable, *is not left empty while a persisted shape names an inlayId* —
      the implication, which passes vacuously only while nothing sockets a gem — and *names the
      socket rather than returning an empty list*, which pins the state the tree is actually in.)
- [x] `Item`'s fused fields appear nowhere; old-shape files meet `IncompatibleDataNotice` with the
      retirement recorded in `RETIRED_FIELDS`; the milestone's `SUPPORTED_SCHEMA_VERSION` bump
      covers it (if this ticket lands the bump, say so and update the `data-model` skill).
      (**This ticket lands v4.0's one bump: `SUPPORTED_SCHEMA_VERSION` 9 → 10**, per
      [D6](../overview.md#d6--no-backwards-compatibility-v40-is-a-clean-break-user-2026-08-29) — no
      conversion, no dual read. `Item` no longer declares either field
      [`shared/types/config.ts`](../../../src/shared/types/config.ts); a grep of `src/` finds
      `materialId` only on `ComposedItem` and its readers. The retirement is recorded as
      `EntitySpec.retired` on the `items` spec in
      [`importExport.ts`](../../../src/shared/services/importExport.ts) — `RETIRED_FIELDS`' sentence
      one entity level down, so the replacement sits beside the fields that took the job over and is
      walked by the checker already walking the entries; six cases in `importExport.test.ts` under
      *retired fields › a field retired from an entity rather than from the configuration*.
      **Its reach is narrow, deliberately, and TICKET-DX-09 should read it that way**: the shape gate
      runs *after* `assertSupportedSchemaVersion`, so a genuine v3 export never reaches
      `EntitySpec.retired` at all — it meets `IncompatibleDataNotice` on the version first. What the
      retirement catches is the **hand-edited or hand-merged file claiming version 10** while still
      fusing a tier onto a template. That is documentation of where the pair went, not a
      compatibility path, which is exactly what D6 says `RETIRED_FIELDS` is for. A stored
      roster written before builds now fails `isReadableCharacter`, which is what routes it to
      `IncompatibleDataNotice` — `storage.test.ts` *refuses a roster written before composed items*.
      The `data-model` skill, `docs/imports/ducklets.json`, `scripts/build-sheet-import.mjs` and
      `examples/demo-ruleset.json` are all brought to 10.)
- [x] Persistence through store actions (`characterStore` locally, shared services on the
      server); the server re-derives both bonus sides through the same calculators and trusts no
      derived value in a request body.
      (Every inventory write is a Kernel call now — `characterStore.addMiscItem` and
      `removeMiscItem` gained one, where they used to patch the inventory in place, because minting
      and unmaking a build are rules rather than picker conveniences; `patchInventory` was deleted
      with its last caller. The server route `takeItem.ts` mints its own id and calls the same
      `addToPack`. `uploadedCharacterErrors` checks every field of a composed record a reader
      dereferences and nothing derived — `characterShape.test.ts` *checks every field of a composed
      record a reader dereferences*.)
- [x] Unit tests cover: composition arithmetic (with and without inlay), the Mana/Speed
      inlay-only rule, guarded-delete edges, and the record's round-trip through import/export.
      (Arithmetic and the inlay-only rule: the *inlay term* describe above. Guarded deletes:
      `dependencies.test.ts`. Round-trip: `characterShape.test.ts` *round-trips a full triple through
      JSON and past the gate* — a character document is JSON on both homes (v3 D4), so its round-trip
      is `uploadedCharacterErrors` rather than `importExport`, which serialises a *Configuration*;
      the item template's own round-trip and the retired pair's refusal are in `importExport.test.ts`.)
- [ ] ~~Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of an equipped composed item's numbers (ask the User
      first).~~ **Half done.** `npx vitest run` (3414 / 200 files / 0 failing / 0 skipped),
      `npx tsc --noEmit` at its documented 2-error baseline, `yarn run check` clean, and `fallow` run
      three ways with its two introduced findings fixed in the same change (see TEST_STATUS.md).
      **The browser check was skipped by User instruction for this run**, so an equipped composed
      item's numbers have not been seen live; the `conventions-reviewer` pass runs on the diff before
      it is committed.

## Notes added while building (2026-08-29)

- **A build is one thing, and the actions now enforce it.** Equipping used to leave the item in the
  pack, which was harmless while an id named a catalog *template* — two of a thing were the same id
  twice and indistinguishable — and is an object in two places once the id names a build. `wearingOnly`
  takes it out of every other slot and `equipToSlot` takes it out of the pack. The server suite found
  this, not the unit tests: *swaps a slot occupant back into the pack* came back with the helm listed
  twice.
- **And its sibling, found by the review: `equipToSlot` orphaned what it displaced.** The previous
  occupant left `equippedItems` and went nowhere — not the pack, not out of existence — so the record
  survived in `composedItems` worn by nothing and carried by nothing: invisible to every surface, and
  still counted by `composedItemReferences`, which made its material **permanently undeletable** with
  a refusal naming a Player who cannot see the thing. **It stows now**, matching `moveItemToEquipment`:
  the Player asked to put something *on*, not to throw away what they were wearing, and destruction
  stays where it is explicit. Reachable through `POST /api/characters/:id/equip-item` and
  `characterStore.equipItem`; the UI goes through `wear-item`, which is why nothing noticed.
- **`equipToSlot` and `moveItemToEquipment` are now one implementation.** Fixing the orphan made the
  two bodies identical, and that is a real consequence of the reshape rather than an accident: *equip*
  differed from *wear* only because an id named a shared template — it could write a slot without
  touching the pack, and the thing it displaced was not the Player's property. Neither half survives a
  record `slotRefusal` requires the character to hold. Both names stay, because
  `PLAYER_ACTION.EQUIP_ITEM` and `WEAR_ITEM` are the *act* vocabulary the routes and the Event log
  speak; **whether the API still needs two is TICKET-INV-06's to decide**, since that ticket is
  rethinking the inventory's surface anyway.
- **Dropping destroys the build; stowing keeps it.** `emptySlot` removes the record from
  `composedItems` as well as from the slot, and `removeFromPack` does the same — a build that is
  nowhere is not stored, or the collection fills with things nobody can see whose materials nobody can
  delete. `moveItemToMisc` keeps it, which is the whole difference between the two.
- **`removeFromPack` takes exactly the build named**, where v1.0 took every copy. That is not a
  decision this ticket made so much as one the shape made available: two ropes are two builds now.

## Notes

- The builder flow, the derived display phrase, and the Backpack list are **TICKET-INV-06** —
  this ticket is the shape and the math; that one is the surface. What INV-06 inherits, concretely:
  `useInventoryManager` resolves an inventory id to a `CarriedBuild` (`{ build, item }`) and hands the
  whole record through, so the display phrase needs no new field; the pack picker still offers
  *templates* and `addMiscItem` mints a build from one, which is the call the three-column builder
  replaces; and an `inlayLevel` naming a rung the family skips resolves to nothing in the engine, so
  **telling the Player about it is INV-06's picker refusal** rather than an engine report.
- The sheet keys its gear columns on the composed display *name*; the app keys on ids and treats
  the phrase as display (the standing rule) — the fragment's `notes` records the divergence.
- **Three things INL-01 hands over.** (1) An `InlayTier.tier` is a whole number from 1 up and
  **unique within the family**, enforced in both places the model's identity rules always are — so
  `inlayLevel` may address a rung by number and get one answer. (2) A family's ladder may have a
  **gap** (the sheet's Zircon has no tenth), so an `inlayLevel` naming an absent rung is a real
  case: report it the way `itemIssues` already reports a `materialLevel` that names no tier. (3)
  `Inlay.tiers` is stored in **insertion order**, not rung order — sort before displaying or
  looking up by position, as `InlayCard` does.
- ~~**Two clones become owed if this ticket adds a third caller.**~~ **One of the two was paid by
  TICKET-ITEM-01 (2026-08-29).** The group-by-a-free-string mapper is now shared —
  `groupByLabel` / `hasNamedGroups` in
  [`client/components/shared/labelledGroups.ts`](../../../src/client/components/shared/labelledGroups.ts),
  with three callers (`Stat.group`, `Inlay.group`, `Item.shop`) — so a fourth grouped list **uses**
  it rather than owing anything. Still standing at two: the `modifiableStats` pair
  (`useInlayManager` ↔ `useMaterialManager`), which ITEM-01 deliberately did not make a third of,
  because *the skills a bonus may target* is `config.skills` and not the sort-and-filter expression
  it resembles. **A third `modifiableStats` still makes that extraction due.** A fourth caller also
  landed on the sparse rows editor, which is why it is `ValueRowsField` over `options` now rather
  than `StatValueRowsField` over `Stat[]` — reuse it for a socket picker rather than copying it.
