/**
 * Equipment Bonus Calculator Tests
 * 
 * Tests for equipment bonus aggregation including material bonuses.
 */

import { describe, it, expect } from 'vitest';
import { calculateEquipmentBonuses } from './equipmentBonusCalculator';
import type { Character } from '../../types/character';
import type { Configuration, Material, Item } from '../../types/config';

describe('calculateEquipmentBonuses', () => {
  it('should return empty array when no items equipped', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
              { skillCode: 'STR', modifier: 2 },
              { skillCode: 'DEF', modifier: 3 },
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ skillCode: 'STR', modifier: 2 });
    expect(result).toContainEqual({ skillCode: 'DEF', modifier: 3 });
  });

  it('should combine bonuses from multiple equipped items additively', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
              { skillCode: 'STR', modifier: 2 },
              { skillCode: 'DEF', modifier: 3 },
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
              { skillCode: 'STR', modifier: 1 },
              { skillCode: 'DEF', modifier: 5 },
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ skillCode: 'STR', modifier: 3 }); // 2 + 1
    expect(result).toContainEqual({ skillCode: 'DEF', modifier: 8 }); // 3 + 5
  });

  it('should handle different material levels correctly', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
            bonuses: [{ skillCode: 'STR', modifier: 2 }],
            value: { tierId: 'gold', amount: 10 },
          },
          {
            level: 2,
            name: 'Refined Iron',
            bonuses: [{ skillCode: 'STR', modifier: 4 }],
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(1);
    expect(result).toContainEqual({ skillCode: 'STR', modifier: 6 }); // 2 + 4
  });

  it('should handle negative modifiers (penalties)', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
              { skillCode: 'DEF', modifier: 5 },
              { skillCode: 'DEX', modifier: -2 }, // Penalty
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ skillCode: 'DEF', modifier: 5 });
    expect(result).toContainEqual({ skillCode: 'DEX', modifier: -2 });
  });

  it('should ignore items not found in configuration', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
            bonuses: [{ skillCode: 'STR', modifier: 2 }],
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
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
      mainSkillLevels: {},
      specialitySkillBaseLevels: {},
      currentStatValues: {},
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
              { skillCode: 'STR', modifier: 2 },
              { skillCode: 'DEF', modifier: 3 },
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
              { skillCode: 'DEX', modifier: 3 },
              { skillCode: 'DEF', modifier: 1 },
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
      mainSkills: [],
      stats: [],
      specialitySkills: [],
      combatSkills: [],
      materials,
      materialCategories: [],
      items,
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateEquipmentBonuses(character, config);

    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ skillCode: 'STR', modifier: 4 }); // 2 + 2
    expect(result).toContainEqual({ skillCode: 'DEF', modifier: 8 }); // 3 + 3 + 1 + 1
    expect(result).toContainEqual({ skillCode: 'DEX', modifier: 6 }); // 3 + 3
  });
});
