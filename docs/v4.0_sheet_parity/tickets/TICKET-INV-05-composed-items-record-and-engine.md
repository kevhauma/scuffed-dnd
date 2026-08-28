# TICKET-INV-05 — Composed items: the record and the engine

- **Area:** Inventory & equipment / engine
- **Type:** Feature (new player state + engine, one deletion)
- **Traceability:** System [12 · Item composition](../systems/12-item-composition-and-backpack.md)
  (gaps 1, 2); overview [Rulings 2026-08-29](../overview.md#rulings-user-2026-08-29) (composed
  items live in the Player's inventory, as links). **Needs TICKET-INV-04** (the six slots),
  **TICKET-MAT-03 / TICKET-INL-01 / TICKET-ITEM-01** (the three parts a record links).

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

- [ ] The sample reproduces end to end: *Iron Ore 10 Battleaxe with Diamond 4 inlay* in
      `right_hand` → stats Str 18 / Con 18 / Char 8 / Health 5 / Mana 4000, skills = the
      Battleaxe vector — engine test through `calculateCharacter`, golden-fixture-ready.
- [ ] Retuning a material tier moves every composed item made of it on the next read — nothing
      stored, pinned by a test that edits the tier and re-derives.
- [ ] A composed record with no inlay contributes the material row alone (`inlayId?` absent is
      legal — the sheet's "with empty inlay").
- [ ] Deleting a referenced material/template/inlay is refused naming the characters holding it;
      an unreferenced one deletes — `dependencies` tests for each new edge.
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
