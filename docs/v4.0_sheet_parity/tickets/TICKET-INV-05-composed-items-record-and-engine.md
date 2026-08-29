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

## Acceptance criteria

- [ ] The composition reproduces end to end on a fixture shaped like the sample — a material tier
      plus an inlay tier plus a template vector in one hand slot → stats from material + inlay,
      skills from the template — engine test through `calculateCharacter`. The sample's own numbers
      (Str 18 / Con 18 / Char 8 / Health 5 / Mana 4000) pin once the data pass seeds the parts.
- [ ] Retuning a material tier moves every composed item made of it on the next read — nothing
      stored, pinned by a test that edits the tier and re-derives.
- [ ] A composed record with no inlay contributes the material row alone (`inlayId?` absent is
      legal — the sheet's "with empty inlay").
- [ ] Deleting a referenced material/template/inlay is refused naming the characters holding it;
      an unreferenced one deletes — `dependencies` tests for each new edge.
- [ ] **The `inlay` arm of `findReferences` is filled, and a scan test makes forgetting it a
      failure.** TICKET-INL-01 shipped the `inlay` target kind returning `[]` deliberately (nothing
      could point at one yet), and the `switch`'s `never` default catches a **missing kind** but not
      a **new referrer to an existing kind** — so adding `inlayId` while leaving that arm empty
      compiles, passes, and silently orphans every socket. Close it the way
      [`components/config/races/challengeRate.test.ts`](../../../src/client/components/config/races/challengeRate.test.ts)
      closes its equivalent: a test that scans `src/` and **fails if `Item` (or the composed record)
      names an `inlayId` while the `inlay` arm still returns nothing**.
- [ ] `Item`'s fused fields appear nowhere; old-shape files meet `IncompatibleDataNotice` with the
      retirement recorded in `RETIRED_FIELDS`; the milestone's `SUPPORTED_SCHEMA_VERSION` bump
      covers it (if this ticket lands the bump, say so and update the `data-model` skill).
- [ ] Persistence through store actions (`characterStore` locally, shared services on the
      server); the server re-derives both bonus sides through the same calculators and trusts no
      derived value in a request body.
- [ ] Unit tests cover: composition arithmetic (with and without inlay), the Mana/Speed
      inlay-only rule, guarded-delete edges, and the record's round-trip through import/export.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of an equipped composed item's numbers (ask the User
      first).

## Notes

- The builder flow, the derived display phrase, and the Backpack list are **TICKET-INV-06** —
  this ticket is the shape and the math; that one is the surface.
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
