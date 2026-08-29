/**
 * Equipment Bonus Calculator Tests
 *
 * Tests for equipment bonus aggregation, which is per **stat** since TICKET-MAT-02: no skill code
 * can be a target any more, and a modifier naming a stat the ruleset does not define is dropped
 * rather than emitted.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type {
  Configuration,
  EquipmentSlot,
  Item,
  Material,
  Skill,
  SkillModifier,
  Stat,
} from '../../types/config';
import {
  calculateEquipmentBonuses,
  calculateEquipmentSkillBonuses,
  indexStatModifiers,
} from './equipmentBonusCalculator';

/**
 * The stats a material tier can target here
 *
 * The aggregate is keyed by stat **id** end to end since TICKET-MAT-02; ids and abbreviations
 * agree in this fixture only so the numbers stay readable.
 */
const STATS: Stat[] = ['STR', 'DEF', 'DEX'].map((abbreviation, order) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  description: '',
  order,
  countsTowardTotal: true,
  isResource: false,
  rounding: 'none',
}));

/**
 * The slots these fixtures wear things in
 *
 * **Every fixture below declares them, and before TICKET-ITEM-01 none did.** They said
 * `equipmentSlots: []` while handing the character `equippedItems: { helmet: 'item1' }` — a ruleset
 * with no slots and a character wearing something in one, which the app cannot produce and which
 * only passed because the calculator walked the record's own values. Both equipment terms read the
 * ruleset's slot list now, so the fixtures describe a ruleset that could exist.
 */
const SLOTS: EquipmentSlot[] = ['helmet', 'chest', 'gloves', 'boots'].map((type) => ({
  type,
  name: type,
  description: '',
}));

describe('calculateEquipmentBonuses', () => {
  it('should return empty array when no items equipped', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should return empty array when equipped items have no materials', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: { helmet: 'item1' },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Basic Helmet',
        description: 'A simple helmet',
        equipmentSlotType: 'helmet',
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [],
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should collect bonuses from single equipped item with material', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: { helmet: 'item1' },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [
              { statId: 'STR', modifier: 2 },
              { statId: 'DEF', modifier: 3 },
            ],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Iron Helmet',
        description: 'A helmet made of iron',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 1,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'STR', modifier: 2 });
    expect(result).toContainEqual({ statId: 'DEF', modifier: 3 });
  });

  it('should combine bonuses from multiple equipped items additively', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: {
          helmet: 'item1',
          chest: 'item2',
        },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [
              { statId: 'STR', modifier: 2 },
              { statId: 'DEF', modifier: 3 },
            ],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
      {
        id: 'mat2',
        name: 'Steel',
        description: 'Refined metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Steel',
            bonuses: [
              { statId: 'STR', modifier: 1 },
              { statId: 'DEF', modifier: 5 },
            ],
            value: { tierId: 'gold', amount: 20 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Iron Helmet',
        description: 'A helmet made of iron',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 1,
      },
      {
        id: 'item2',
        name: 'Steel Chestplate',
        description: 'A chestplate made of steel',
        equipmentSlotType: 'chest',
        materialId: 'mat2',
        materialLevel: 1,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'STR', modifier: 3 }); // 2 + 1
    expect(result).toContainEqual({ statId: 'DEF', modifier: 8 }); // 3 + 5
  });

  it('should handle different material levels correctly', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: {
          helmet: 'item1',
          chest: 'item2',
        },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [{ statId: 'STR', modifier: 2 }],
            value: { tierId: 'gold', amount: 10 },
          },
          {
            level: 2,
            name: 'Refined Iron',
            bonuses: [{ statId: 'STR', modifier: 4 }],
            value: { tierId: 'gold', amount: 20 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Iron Helmet',
        description: 'A helmet made of iron',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 1,
      },
      {
        id: 'item2',
        name: 'Refined Iron Chestplate',
        description: 'A chestplate made of refined iron',
        equipmentSlotType: 'chest',
        materialId: 'mat1',
        materialLevel: 2,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual({ statId: 'STR', modifier: 6 }); // 2 + 4
  });

  it('should handle negative modifiers (penalties)', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: { helmet: 'item1' },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Heavy Iron',
        description: 'Very heavy metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Heavy Iron',
            bonuses: [
              { statId: 'DEF', modifier: 5 },
              { statId: 'DEX', modifier: -2 }, // Penalty
            ],
            value: { tierId: 'gold', amount: 15 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Heavy Iron Helmet',
        description: 'A very heavy helmet',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 1,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ statId: 'DEF', modifier: 5 });
    expect(result).toContainEqual({ statId: 'DEX', modifier: -2 });
  });

  it('should ignore items not found in configuration', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: {
          helmet: 'nonexistent-item',
        },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should ignore items with materials not found in configuration', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: { helmet: 'item1' },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Mystery Helmet',
        description: 'Made of unknown material',
        equipmentSlotType: 'helmet',
        materialId: 'nonexistent-material',
        materialLevel: 1,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [],
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should ignore items with material levels not found', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: { helmet: 'item1' },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [{ statId: 'STR', modifier: 2 }],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Iron Helmet',
        description: 'A helmet made of iron',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 99, // Level doesn't exist
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toEqual([]);
  });

  it('should handle complex scenario with multiple items and overlapping bonuses', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: {
        equippedItems: {
          helmet: 'item1',
          chest: 'item2',
          gloves: 'item3',
          boots: 'item4',
        },
        miscItems: [],
      },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const materials: Material[] = [
      {
        id: 'mat1',
        name: 'Iron',
        description: 'Common metal',
        categoryId: 'metals',
        levels: [
          {
            level: 1,
            name: 'Iron',
            bonuses: [
              { statId: 'STR', modifier: 2 },
              { statId: 'DEF', modifier: 3 },
            ],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
      {
        id: 'mat2',
        name: 'Leather',
        description: 'Flexible material',
        categoryId: 'leather',
        levels: [
          {
            level: 1,
            name: 'Leather',
            bonuses: [
              { statId: 'DEX', modifier: 3 },
              { statId: 'DEF', modifier: 1 },
            ],
            value: { tierId: 'gold', amount: 5 },
          },
        ],
      },
    ];

    const items: Item[] = [
      {
        id: 'item1',
        name: 'Iron Helmet',
        description: 'A helmet made of iron',
        equipmentSlotType: 'helmet',
        materialId: 'mat1',
        materialLevel: 1,
      },
      {
        id: 'item2',
        name: 'Iron Chestplate',
        description: 'A chestplate made of iron',
        equipmentSlotType: 'chest',
        materialId: 'mat1',
        materialLevel: 1,
      },
      {
        id: 'item3',
        name: 'Leather Gloves',
        description: 'Gloves made of leather',
        equipmentSlotType: 'gloves',
        materialId: 'mat2',
        materialLevel: 1,
      },
      {
        id: 'item4',
        name: 'Leather Boots',
        description: 'Boots made of leather',
        equipmentSlotType: 'boots',
        materialId: 'mat2',
        materialLevel: 1,
      },
    ];

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ statId: 'STR', modifier: 4 }); // 2 + 2
    expect(result).toContainEqual({ statId: 'DEF', modifier: 8 }); // 3 + 3 + 1 + 1
    expect(result).toContainEqual({ statId: 'DEX', modifier: 6 }); // 3 + 3
  });
});

describe('a tier modifier naming a stat the ruleset no longer defines (TICKET-MAT-01)', () => {
  it('should contribute nothing rather than inventing a target', () => {
    // The converse of the seeding invariant: the ruleset alone decides what exists, so a dangling
    // `statId` drops out of the aggregate instead of arriving as an `undefined` key
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems: { helmet: 'item1' }, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [
        {
          id: 'mat1',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [
                { statId: 'STR', modifier: 2 },
                { statId: 'deleted-stat', modifier: 99 },
              ],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ],
      materialCategories: [],
      items: [
        {
          id: 'item1',
          name: 'Iron Helmet',
          description: '',
          materialId: 'mat1',
          materialLevel: 1,
          equipmentSlotType: 'helmet',
        },
      ],
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    expect(calculateEquipmentBonuses(character, config)).toEqual([{ statId: 'STR', modifier: 2 }]);
  });
});

describe('an item worn in a slot the ruleset no longer has (TICKET-ITEM-01)', () => {
  it('should grant nothing on the stat axis either, so no item is ever half-counted', () => {
    // **This state is reachable today.** `deleteEquipmentSlot` is a guarded delete, and
    // `useGuardedDelete` offers a "Delete anyway" button that re-runs it with `force: true` — so a
    // character can be left wearing something in a slot the ruleset has dropped. While the stat term
    // walked `Object.values(equippedItems)` and the skill term walked `config.equipmentSlots`, that
    // one sword granted its material's `STR +2` and none of its skill vector, on one sheet.
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      // `retired` is not among `SLOTS`
      inventory: { equippedItems: { retired: 'item1' }, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: [],
      materials: [
        {
          id: 'mat1',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [{ statId: 'STR', modifier: 2 }],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ],
      materialCategories: [],
      items: [
        {
          id: 'item1',
          name: 'Iron Helmet',
          description: '',
          materialId: 'mat1',
          materialLevel: 1,
          equipmentSlotType: 'retired',
        },
      ],
      equipmentSlots: SLOTS,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    expect(calculateEquipmentBonuses(character, config)).toEqual([]);
  });
});

describe('indexStatModifiers', () => {
  it('should index a modifier by its stat id', () => {
    expect(indexStatModifiers([{ statId: 'STR', modifier: 2 }])).toEqual({ STR: 2 });
  });

  it('should combine repeated stats additively', () => {
    expect(
      indexStatModifiers([
        { statId: 'STR', modifier: 2 },
        { statId: 'DEX', modifier: -1 },
        { statId: 'STR', modifier: 3 },
      ])
    ).toEqual({ STR: 5, DEX: -1 });
  });

  it('should return an empty record for no modifiers', () => {
    expect(indexStatModifiers([])).toEqual({});
  });
});

/**
 * The item matrix's half: what an equipped **template** does to the character's skills
 *
 * The stat side above comes from what an item is *made of*; this comes from what it *is* (v4
 * systems/11, TICKET-ITEM-01). The fixtures are deliberately compact and slot-driven, because the
 * one property under test besides the arithmetic is that **nothing here knows how many slots a
 * ruleset has** (TICKET-INV-04).
 */
describe('calculateEquipmentSkillBonuses', () => {
  const SKILLS: Skill[] = ['athletics', 'sneaking', 'intimidation'].map((id) => ({
    id,
    name: id,
    description: '',
    statWeights: [],
  }));

  /**
   * A ruleset with `slotCount` slots named `slot_0`, `slot_1`, … and the given templates
   *
   * @param items - The templates the ruleset defines
   * @param slotCount - How many equipment slots it has — one, six and twelve are all ordinary
   * @returns The configuration
   */
  function createConfig(items: Item[], slotCount: number): Configuration {
    const equipmentSlots: EquipmentSlot[] = Array.from({ length: slotCount }, (_, index) => ({
      type: `slot_${index}`,
      name: `Slot ${index}`,
      description: '',
    }));

    return {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 9,
      stats: STATS,
      skills: SKILLS,
      materials: [],
      materialCategories: [],
      items,
      equipmentSlots,
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
  }

  /**
   * A template carrying a skill vector
   *
   * @param id - The template's id, doubling as its name
   * @param skillBonuses - What wielding it moves; omitted entirely when empty
   * @returns The item
   */
  function template(id: string, skillBonuses?: SkillModifier[]): Item {
    return { id, name: id, description: '', skillBonuses };
  }

  /**
   * A character with the given slots filled
   *
   * @param equippedItems - Slot type to item id
   * @returns The character
   */
  function createCharacter(equippedItems: Record<string, string>): Character {
    return {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {},
      investedSkillPoints: {},
      currentResourceValues: {},
      experience: 0,
      inventory: { equippedItems, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
  }

  it('should read an equipped templates vector, positives and negatives alike', () => {
    const battleaxe = template('battleaxe', [
      { skillId: 'athletics', modifier: 2 },
      { skillId: 'intimidation', modifier: 3 },
      { skillId: 'sneaking', modifier: -1 },
    ]);
    const config = createConfig([battleaxe], 1);

    const wielder = createCharacter({ slot_0: 'battleaxe' });

    const bonuses = calculateEquipmentSkillBonuses(wielder, config);

    expect(bonuses).toEqual({ athletics: 2, intimidation: 3, sneaking: -1 });
  });

  it('should read nothing off a template the character is not wearing', () => {
    const battleaxe = template('battleaxe', [{ skillId: 'athletics', modifier: 2 }]);
    const config = createConfig([battleaxe], 1);

    const emptyHanded = createCharacter({});

    const bonuses = calculateEquipmentSkillBonuses(emptyHanded, config);

    expect(bonuses).toEqual({});
  });

  it('should sum across a one-slot ruleset and a twelve-slot one alike (TICKET-INV-04)', () => {
    const axe = template('axe', [{ skillId: 'athletics', modifier: 2 }]);
    const boots = template('boots', [
      { skillId: 'athletics', modifier: 1 },
      { skillId: 'sneaking', modifier: -3 },
    ]);

    const narrowRuleset = createConfig([axe, boots], 1);
    const wideRuleset = createConfig([axe, boots], 12);
    const armed = createCharacter({ slot_0: 'axe' });
    const kitted = createCharacter({ slot_0: 'axe', slot_11: 'boots' });

    const oneSlot = calculateEquipmentSkillBonuses(armed, narrowRuleset);
    const twelveSlots = calculateEquipmentSkillBonuses(kitted, wideRuleset);

    // The count is the ruleset's; the arithmetic is the same either way
    expect(oneSlot).toEqual({ athletics: 2 });
    expect(twelveSlots).toEqual({ athletics: 3, sneaking: -3 });
  });

  it('should let a negative row cancel a positive one to nothing', () => {
    const blessed = template('blessed', [{ skillId: 'sneaking', modifier: 2 }]);
    const cursed = template('cursed', [{ skillId: 'sneaking', modifier: -2 }]);
    const config = createConfig([blessed, cursed], 2);

    const wearingBoth = createCharacter({ slot_0: 'blessed', slot_1: 'cursed' });

    const bonuses = calculateEquipmentSkillBonuses(wearingBoth, config);

    // Present at zero rather than absent: two templates really did name it, and the sum is 0
    expect(bonuses).toEqual({ sneaking: 0 });
  });

  it('should read nothing off a template with no vector at all', () => {
    const plain = template('plain');
    const config = createConfig([plain], 1);

    const wielder = createCharacter({ slot_0: 'plain' });

    const bonuses = calculateEquipmentSkillBonuses(wielder, config);

    expect(bonuses).toEqual({});
  });

  it('should drop a bonus naming a skill the ruleset no longer defines', () => {
    const relic = template('relic', [
      { skillId: 'athletics', modifier: 2 },
      { skillId: 'gone', modifier: 99 },
    ]);
    const config = createConfig([relic], 1);

    const wielder = createCharacter({ slot_0: 'relic' });

    const bonuses = calculateEquipmentSkillBonuses(wielder, config);

    expect(bonuses).toEqual({ athletics: 2 });
  });

  it('should read nothing off a slot holding an item the ruleset has not got', () => {
    const config = createConfig([], 1);

    const wearingAGhost = createCharacter({ slot_0: 'ghost' });

    const bonuses = calculateEquipmentSkillBonuses(wearingAGhost, config);

    expect(bonuses).toEqual({});
  });

  it('should ignore an entry keyed to a slot the ruleset has since deleted', () => {
    const axe = template('axe', [{ skillId: 'athletics', modifier: 2 }]);
    // One slot, and the character is wearing the axe in a second one that no longer exists
    const config = createConfig([axe], 1);

    const wearingARetiredSlot = createCharacter({ retired: 'axe' });

    const bonuses = calculateEquipmentSkillBonuses(wearingARetiredSlot, config);

    expect(bonuses).toEqual({});
  });
});
