# TICKET-ITEM-01 — Item templates target skills, grouped into shops

- **Area:** Items configuration / engine
- **Type:** Feature
- **Traceability:** System [11 · Items and shops](../systems/11-items-and-shops.md) (gaps 1, 2,
  4); system [06](../systems/06-skills-and-focus.md) (gap 5 — the gear term in the skill level).
  **Needs TICKET-SKL-04** — the gear term sits beside its ceil, so the rounding settles first.
  First ticket of the **`ITEM`** prefix.

> **Scope (overview [D7](../overview.md#d7--seeded-values-and-formula-text-are-a-separate-issue-user-2026-08-29)):**
> every item's vector and every category's shop are seeded values, so they are the data pass's
> (TICKET-ITEM-02 is that lift, deferred with it). It owes this ticket the Battleaxe row it was
> going to seed here — +2 Athletics, +3 intimidation, −1 Assassination and the rest — and the shop
> tag on all 40 categories.

## User story

As a Player, I want a wielded Battleaxe to make me better at Athletics and intimidation and worse
at Sneaking — so what I hold changes what I can do, the way the sheet's item matrix says.

## Description

An item template becomes a per-skill bonus vector: small signed integers over the ruleset's
skills, no stat columns and no prices (an item's stat side comes entirely from its material and
inlay — systems/12). Categories gain their shop tagging. The engine learns to sum equipped
templates' skill bonuses into skill levels — the shape `statCalculator` already has for equipment.

## Current situation (as-is)

- [items.json](../../imports/items.json) holds 191 v1.0-shape templates: name, description,
  `categoryId?`, `materialId?`, `materialLevel?`, `equipmentSlotType?` — **no bonuses of their
  own** (the old sheet's item stat columns were all zero).
- [skillCalculator.ts](../../../src/shared/engine/calculators/skillCalculator.ts) knows nothing
  of equipment; only stats get gear bonuses
  ([equipmentBonusCalculator.ts](../../../src/shared/engine/calculators/equipmentBonusCalculator.ts),
  TICKET-MAT-02).
- Categories exist (`categoryId` points at them); nothing models a shop.

## Desired result (to-be)

- **`Item.skillBonuses?: [{skillId, modifier}]`** — sparse (only nonzero entries), keyed by skill
  **id** (the same id-keyed treatment `MaterialModifier` got in TICKET-MAT-01: a rename cannot
  orphan a bonus). Additive-optional.
- **Shops**: a category can name its shop — whether as a field on `ItemCategory` or as shop records
  holding categories is this ticket's call (the sheet writes `category (shop)` on one line;
  smallest shape wins). A ruleset that names no shops groups by category as it does today.
- **The engine term**: per equipped slot, the item's `skillBonuses` sum into the skill's
  **bonus** — `bonus = ceil(level / 5) + Σ(gear skill bonuses across the equipped slots)`, exactly
  as read from the calculation tab (systems/06). One calculator, no inline recomputation, and no
  assumption about how many slots there are.

## Acceptance criteria

- [ ] An equipped template's vector moves the skill bonus; an unequipped one moves nothing;
      negatives subtract — engine tests through `calculateCharacter` against a fixture of the
      ticket's own.
- [ ] The gear term lands in the **bonus**, not the level, and survives the ceil ordering — pinned
      against systems/06's formula.
- [ ] A skill rename orphans no bonus (id-keyed, TICKET-MAT-01's precedent) — pinned.
- [ ] Shop tagging renders in the config panel's grouping
      ([ItemsConfigPanel.tsx](../../../src/client/components/config/items/ItemsConfigPanel.tsx))
      without a new top-level route; categories keep working for rulesets with no shops.
- [ ] [items.json](../../imports/items.json) is **not** touched here (D7) — a ruleset whose items
      carry no `skillBonuses` computes exactly as it does today, pinned.
- [ ] Unit tests cover: sparse storage (zero entries absent), per-slot summation over however many
      slots the ruleset has (TICKET-INV-04), negative bonuses, and validation of `skillId` targets.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of an equip moving a skill bonus (ask the User first).

## Notes

- Consumables carry vectors like equipment; nothing marks them consumable. The app's rule stays:
  bonuses apply when **equipped** — kept, with the gap noted (systems/11's open question).
- The old `materialId`/`materialLevel` fused-instance fields retire in TICKET-INV-05, not here —
  one reshape per ticket.
