/**
 * What a build is called, and what is in the bag (TICKET-INV-06)
 *
 * Two derivations that used to be a stored `name` and a stored `miscItems` list respectively, and
 * the cases here are mostly about the *deriving*: rename a material and every axe made of it is
 * relabelled, wear a thing and it leaves the Backpack, without either write touching the other.
 *
 * The tier lookups are covered where they are used — `equipmentBonusCalculator.test.ts` prices a
 * build, `playerActions.test.ts` refuses a rung a family skips — so what is left here is the phrase
 * and the partition.
 *
 * **Validates: Requirements 12.1, 12.4; v4 systems/12**
 */

import { describe, expect, it } from 'vitest';
import type { Character, ComposedItem } from '../types/character';
import type { Configuration } from '../types/config';
import { backpackOf, composedItemLabel, wornBuildIds } from './composedItems';

/** A ruleset with one metal at two rungs, one gem with a gap, and three templates */
const RULES = {
  id: 'config-1',
  name: 'Test',
  version: '1.0',
  schemaVersion: 10,
  stats: [],
  skills: [],
  materials: [
    {
      id: 'mat-iron',
      name: 'Iron Ore',
      description: '',
      categoryId: 'metal',
      levels: [
        { level: 1, name: 'Pig iron', bonuses: [], value: { tierId: 'gold', amount: 1 } },
        { level: 10, name: 'Wrought', bonuses: [], value: { tierId: 'gold', amount: 10 } },
      ],
    },
  ],
  materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
  inlays: [
    {
      id: 'inlay-diamond',
      name: 'Diamond',
      description: '',
      tiers: [{ tier: 4, bonuses: [] }],
    },
  ],
  items: [
    { id: 'item-axe', name: 'Battleaxe', description: '', equipmentSlotType: 'main_hand' },
    { id: 'item-helm', name: 'Helm', description: '', equipmentSlotType: 'head' },
    { id: 'item-rope', name: 'Rope', description: '' },
  ],
  equipmentSlots: [
    { type: 'main_hand', name: 'Main Hand', description: '' },
    { type: 'head', name: 'Head', description: '' },
  ],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} as unknown as Configuration;

/** The sample the workbook itself verifies, minus the double space its item cell carries */
const BATTLEAXE: ComposedItem = {
  id: 'build-axe',
  templateId: 'item-axe',
  materialId: 'mat-iron',
  materialLevel: 10,
  inlayId: 'inlay-diamond',
  inlayLevel: 4,
};

function aCharacter(
  equippedItems: Record<string, string>,
  composedItems: ComposedItem[]
): Character {
  return {
    id: 'character-1',
    name: 'Quackers',
    configurationId: 'config-1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems, composedItems },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

describe('the display phrase', () => {
  it('spells the sheet’s own concatenation', () => {
    // `Background Item selecter`'s formula: material & " " & item & " with " & inlay & " inlay"
    expect(composedItemLabel(BATTLEAXE, RULES)).toBe('Iron Ore 10 Battleaxe with Diamond 4 inlay');
  });

  it('writes "with empty inlay" for an unsocketed build, as the sheet does', () => {
    const { inlayId: _gem, inlayLevel: _rung, ...bare } = BATTLEAXE;

    expect(composedItemLabel(bare, RULES)).toBe('Iron Ore 10 Battleaxe with empty inlay');
  });

  it('carries one space between the metal and the shape, not the sheet’s two', () => {
    // The sample's `Adamantine Ore 10  Battleaxe` is the item cell's own leading space — a data
    // quirk systems/12 records and this deliberately does not reproduce
    expect(composedItemLabel(BATTLEAXE, RULES)).not.toContain('  ');
  });

  it('moves when the material is renamed, because nothing about it is stored', () => {
    const renamed = {
      ...RULES,
      materials: [{ ...RULES.materials[0], name: 'Adamantine Ore' }],
    };

    expect(composedItemLabel(BATTLEAXE, renamed)).toBe(
      'Adamantine Ore 10 Battleaxe with Diamond 4 inlay'
    );
  });

  it('names a build made of nothing by its template alone', () => {
    const rope: ComposedItem = { id: 'build-rope', templateId: 'item-rope' };

    expect(composedItemLabel(rope, RULES)).toBe('Rope with empty inlay');
  });

  it('says Unknown item rather than going blank when the template is gone', () => {
    const orphan: ComposedItem = { ...BATTLEAXE, templateId: 'item-deleted' };

    expect(composedItemLabel(orphan, RULES)).toBe('Iron Ore 10 Unknown item with Diamond 4 inlay');
  });

  it('drops a part the ruleset no longer defines out of the phrase', () => {
    const noMetal: ComposedItem = { ...BATTLEAXE, materialId: 'mat-deleted' };
    const noGem: ComposedItem = { ...BATTLEAXE, inlayId: 'inlay-deleted' };

    expect(composedItemLabel(noMetal, RULES)).toBe('Battleaxe with Diamond 4 inlay');
    expect(composedItemLabel(noGem, RULES)).toBe('Iron Ore 10 Battleaxe with empty inlay');
  });

  it('prints the rung the record claims even where the family skips it', () => {
    // The phrase says what the record *is*; what such a rung is worth is `materialTierOf`'s
    // separate answer, which is nothing
    const gap: ComposedItem = { ...BATTLEAXE, materialLevel: 5 };

    expect(composedItemLabel(gap, RULES)).toContain('Iron Ore 5');
  });
});

describe('the Backpack', () => {
  const AXE: ComposedItem = { id: 'build-axe', templateId: 'item-axe' };
  const HELM: ComposedItem = { id: 'build-helm', templateId: 'item-helm' };
  const ROPE: ComposedItem = { id: 'build-rope', templateId: 'item-rope' };

  it('is everything built and not worn — the sheet’s own FILTER', () => {
    const character = aCharacter({ main_hand: 'build-axe' }, [AXE, HELM, ROPE]);

    expect(backpackOf(character, RULES).map((build) => build.id)).toEqual([
      'build-helm',
      'build-rope',
    ]);
  });

  it('holds everything when nothing is worn, and nothing when everything is', () => {
    const idle = aCharacter({}, [AXE, HELM]);
    const kitted = aCharacter({ main_hand: 'build-axe', head: 'build-helm' }, [AXE, HELM]);

    expect(backpackOf(idle, RULES)).toHaveLength(2);
    expect(backpackOf(kitted, RULES)).toEqual([]);
  });

  it('keeps the order the builds were made in', () => {
    const character = aCharacter({}, [ROPE, AXE, HELM]);

    expect(backpackOf(character, RULES).map((build) => build.id)).toEqual([
      'build-rope',
      'build-axe',
      'build-helm',
    ]);
  });

  it('partitions the character’s builds with the worn set, leaving none in neither', () => {
    const character = aCharacter({ head: 'build-helm' }, [AXE, HELM, ROPE]);

    const worn = wornBuildIds(character, RULES);
    const held = [...worn, ...backpackOf(character, RULES).map((build) => build.id)];

    expect(held.sort()).toEqual(['build-axe', 'build-helm', 'build-rope']);
  });

  it('bags a build stranded in a slot the ruleset no longer defines', () => {
    // `deleteEquipmentSlot` offers a *Delete anyway*, so this is reachable in one click. Reading the
    // raw keys of `equippedItems` would leave the build in no Backpack and worn nowhere real —
    // exactly the invisible-record state deleting `miscItems` was meant to make impossible
    const stranded = aCharacter({ retired_slot: 'build-axe' }, [AXE]);

    expect(wornBuildIds(stranded, RULES).size).toBe(0);
    expect(backpackOf(stranded, RULES)).toEqual([AXE]);
  });

  it('ignores a slot naming a build the character does not hold', () => {
    const dangling = aCharacter({ main_hand: 'build-somebody-elses' }, [HELM]);

    expect(backpackOf(dangling, RULES)).toEqual([HELM]);
  });
});
