# TICKET-ITEM-01 — Item templates target skills, grouped into shops

- **Area:** Items configuration / engine
- **Type:** Feature
- **Traceability:** System [11 · Items and shops](../systems/11-items-and-shops.md) (gaps 1, 2,
  4); system [06](../systems/06-skills-and-focus.md) (gap 5 — the gear term in the skill level).
  **Needs TICKET-SKL-04** (the re-scaled skill list the bonuses target). First ticket of the
  **`ITEM`** prefix.

## User story

As a Player, I want a wielded Battleaxe to make me better at Athletics and intimidation and worse
at Sneaking — so what I hold changes what I can do, the way the sheet's item matrix says.

## Description

An item template becomes a per-skill bonus vector: small signed integers over the 48 skills, no
stat columns and no prices (an item's stat side comes entirely from its material and inlay —
systems/12). Categories gain their shop tagging. The engine learns to sum equipped templates'
skill bonuses into skill levels — the shape `statCalculator` already has for equipment.

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
- **Shops**: the 40 categories tagged with their shop — whether as a field on `ItemCategory` or 9
  shop records holding categories is this ticket's call (the sheet writes `category (shop)` on
  one line; smallest shape wins).
- **The engine term**: per equipped slot, the item's `skillBonuses` sum into the skill's
  **bonus** — `bonus = ceil(level / 5) + Σ(gear skill bonuses across the six slots)`, exactly as
  read from the calculation tab (systems/06). One calculator, no inline recomputation.

## Acceptance criteria

- [ ] An equipped template's vector moves the skill bonus (the sample's intimidation +3 includes
      a +3 gear term); an unequipped one moves nothing; negatives subtract — engine tests through
      `calculateCharacter`.
- [ ] The gear term lands in the **bonus**, not the level, and survives the ceil ordering — pinned
      against systems/06's formula.
- [ ] A skill rename orphans no bonus (id-keyed, TICKET-MAT-01's precedent) — pinned.
- [ ] Shop tagging renders in the config panel's grouping
      ([ItemsConfigPanel.tsx](../../../src/client/components/config/items/ItemsConfigPanel.tsx))
      without a new top-level route; categories keep working for rulesets with no shops.
- [ ] [items.json](../../imports/items.json) is **not** rewritten here — the full catalog is
      TICKET-ITEM-02's lift; this ticket updates the *shape* and seeds a handful of
      sample-confirmed vectors (the Battleaxe row) so the engine tests run against real data,
      recorded in the fragment's `notes` as partial pending ITEM-02.
- [ ] Unit tests cover: sparse storage (zero entries absent), per-slot summation over the six
      slots, negative bonuses, and validation of `skillId` targets.
- [ ] Verified via the `verifier` subagent, the `fallow` skill, and the `coding-conventions`
      skill, plus a live browser check of an equip moving a skill bonus (ask the User first).

## Notes

- Consumables carry vectors like equipment; nothing marks them consumable. The app's rule stays:
  bonuses apply when **equipped** — kept, with the gap noted (systems/11's open question).
- The old `materialId`/`materialLevel` fused-instance fields retire in TICKET-INV-05, not here —
  one reshape per ticket.
