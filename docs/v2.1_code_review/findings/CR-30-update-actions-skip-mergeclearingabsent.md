# CR-30 — Three update actions use plain spread instead of `mergeClearingAbsent`

**Severity:** Low · **Area:** config store · **Type:** inconsistent pattern (violates the store's own documented rule)

## Summary

`updateSkill`, `updateItem`, and `updateEquipmentSlot` merge with plain `{...entity, ...updates}`
rather than the store's `mergeClearingAbsent`, so clearing an optional field leaves a
present-but-`undefined` key in memory — inconsistent with `updateStat`, `updateDiceLadder`, and
`updateRollDefinition`.

## Evidence

- `src/stores/configStore.ts:670-690` (`updateSkill`), `:768-777` (`updateItem`), `:797-808`
  (`updateEquipmentSlot`).
- Affected optional fields: `Skill.category`, `Item.materialId` / `Item.equipmentSlotType`.
- The store's own documented rule: `configStore.ts:443-454`.
- Behaviorally benign **today**: `JSON.stringify` drops `undefined` keys on persist, so disk is
  clean; only the in-memory shape diverges.

## Impact

Any consumer distinguishing "key absent" from "key present but undefined" (e.g. `'category' in
skill`) behaves differently before vs after a reload. Mostly a consistency debt with a
documented rule.

## Suggested direction

Switch the three actions to `mergeClearingAbsent`, matching their siblings.
