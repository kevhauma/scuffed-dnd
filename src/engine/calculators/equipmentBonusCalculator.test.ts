/**
 * Equipment Bonus Calculator Tests
 *
 * Tests for equipment bonus aggregation, which is per **stat** since TICKET-MAT-02: no skill code
 * can be a target any more, and a modifier naming a stat the ruleset does not define is dropped
 * rather than emitted.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration, Item, Material, Stat } from '../../types/config';
import { calculateEquipmentBonuses, indexStatModifiers } from './equipmentBonusCalculator';

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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
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
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    expect(calculateEquipmentBonuses(character, config)).toEqual([{ statId: 'STR', modifier: 2 }]);
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
