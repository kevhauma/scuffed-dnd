/**
 * Calculation Engine Tests
 * 
 * Tests for stat calculation including racial bonuses and formula evaluation.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalMainSkillLevels,
  calculateMaxStatValues,
  calculateCharacterStats,
} from './calculator';
import type { Character } from '../types/character';
import type { Configuration, Race, Stat } from '../types/config';

describe('calculateTotalMainSkillLevels', () => {
  it('should return base skill levels when no races provided', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateTotalMainSkillLevels(character, []);

    expect(result).toEqual({
      STR: 10,
      DEX: 8,
      CON: 12,
    });
  });

  it('should apply racial bonuses to main skills', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const races: Race[] = [
      {
        id: 'elf',
        name: 'Elf',
        description: 'Agile forest dwellers',
        skillModifiers: [
          { skillCode: 'DEX', modifier: 2 },
          { skillCode: 'STR', modifier: -1 },
        ],
      },
    ];

    const result = calculateTotalMainSkillLevels(character, races);

    expect(result).toEqual({
      STR: 9, // 10 - 1
      DEX: 10, // 8 + 2
      CON: 12, // unchanged
    });
  });

  it('should combine bonuses from multiple races additively', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf', 'human'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const races: Race[] = [
      {
        id: 'elf',
        name: 'Elf',
        description: 'Agile forest dwellers',
        skillModifiers: [
          { skillCode: 'DEX', modifier: 2 },
          { skillCode: 'STR', modifier: -1 },
        ],
      },
      {
        id: 'human',
        name: 'Human',
        description: 'Versatile and adaptable',
        skillModifiers: [
          { skillCode: 'STR', modifier: 1 },
          { skillCode: 'CON', modifier: 1 },
        ],
      },
    ];

    const result = calculateTotalMainSkillLevels(character, races);

    expect(result).toEqual({
      STR: 10, // 10 - 1 + 1 = 10
      DEX: 10, // 8 + 2 = 10
      CON: 13, // 12 + 1 = 13
    });
  });

  it('should handle racial bonuses for skills not in base levels', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['dwarf'],
      mainSkillLevels: {
        STR: 10,
      },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const races: Race[] = [
      {
        id: 'dwarf',
        name: 'Dwarf',
        description: 'Sturdy mountain folk',
        skillModifiers: [
          { skillCode: 'CON', modifier: 3 }, // CON not in base levels
        ],
      },
    ];

    const result = calculateTotalMainSkillLevels(character, races);

    expect(result).toEqual({
      STR: 10,
      CON: 3, // 0 + 3
    });
  });
});

describe('calculateMaxStatValues', () => {
  it('should calculate stat values from simple formulas', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * 10',
      },
      {
        id: 'stamina',
        name: 'Stamina',
        description: 'Endurance',
        formula: 'CON * 5',
      },
    ];

    const mainSkillLevels = {
      STR: 10,
      CON: 12,
    };

    const result = calculateMaxStatValues(stats, mainSkillLevels);

    expect(result).toEqual({
      health: 100, // 10 * 10
      stamina: 60, // 12 * 5
    });
  });

  it('should calculate stat values from complex formulas', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * 10 + CON * 5',
      },
      {
        id: 'mana',
        name: 'Mana',
        description: 'Magic points',
        formula: '(WIS + INT) * 8',
      },
    ];

    const mainSkillLevels = {
      STR: 10,
      CON: 12,
      WIS: 15,
      INT: 13,
    };

    const result = calculateMaxStatValues(stats, mainSkillLevels);

    expect(result).toEqual({
      health: 160, // 10 * 10 + 12 * 5 = 100 + 60
      mana: 224, // (15 + 13) * 8 = 28 * 8
    });
  });

  it('should handle division in formulas', () => {
    const stats: Stat[] = [
      {
        id: 'speed',
        name: 'Speed',
        description: 'Movement speed',
        formula: '(DEX + STR) / 2',
      },
    ];

    const mainSkillLevels = {
      STR: 10,
      DEX: 14,
    };

    const result = calculateMaxStatValues(stats, mainSkillLevels);

    expect(result).toEqual({
      speed: 12, // (14 + 10) / 2 = 24 / 2
    });
  });

  it('should handle negative values in formulas', () => {
    const stats: Stat[] = [
      {
        id: 'balance',
        name: 'Balance',
        description: 'Physical balance',
        formula: 'DEX - STR',
      },
    ];

    const mainSkillLevels = {
      STR: 15,
      DEX: 10,
    };

    const result = calculateMaxStatValues(stats, mainSkillLevels);

    expect(result).toEqual({
      balance: -5, // 10 - 15
    });
  });

  it('should throw error for undefined variables in formula', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * 10 + MISSING * 5',
      },
    ];

    const mainSkillLevels = {
      STR: 10,
    };

    expect(() => calculateMaxStatValues(stats, mainSkillLevels)).toThrow(
      /Failed to calculate stat "Health"/
    );
  });

  it('should throw error for invalid formula syntax', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * * 10', // Invalid syntax
      },
    ];

    const mainSkillLevels = {
      STR: 10,
    };

    expect(() => calculateMaxStatValues(stats, mainSkillLevels)).toThrow(
      /Failed to calculate stat "Health"/
    );
  });
});

describe('calculateCharacterStats', () => {
  it('should calculate stats with racial bonuses applied', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
        CON: 12,
      },
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
      mainSkills: [
        { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
        { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
        { code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
      ],
      stats: [
        {
          id: 'health',
          name: 'Health',
          description: 'Hit points',
          formula: 'STR * 10 + CON * 5',
        },
        {
          id: 'evasion',
          name: 'Evasion',
          description: 'Dodge chance',
          formula: 'DEX * 2',
        },
      ],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [
        {
          id: 'elf',
          name: 'Elf',
          description: 'Agile forest dwellers',
          skillModifiers: [
            { skillCode: 'DEX', modifier: 2 }, // DEX becomes 10
            { skillCode: 'STR', modifier: -1 }, // STR becomes 9
          ],
        },
      ],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      health: 150, // (10 - 1) * 10 + 12 * 5 = 9 * 10 + 60 = 90 + 60
      evasion: 20, // (8 + 2) * 2 = 10 * 2
    });
  });

  it('should calculate stats with multiple races', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: ['elf', 'human'],
      mainSkillLevels: {
        STR: 10,
        DEX: 8,
      },
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
      mainSkills: [
        { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
        { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
      ],
      stats: [
        {
          id: 'power',
          name: 'Power',
          description: 'Physical power',
          formula: 'STR + DEX',
        },
      ],
      specialitySkills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [
        {
          id: 'elf',
          name: 'Elf',
          description: 'Agile forest dwellers',
          skillModifiers: [
            { skillCode: 'DEX', modifier: 2 },
            { skillCode: 'STR', modifier: -1 },
          ],
        },
        {
          id: 'human',
          name: 'Human',
          description: 'Versatile and adaptable',
          skillModifiers: [
            { skillCode: 'STR', modifier: 1 },
          ],
        },
      ],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      power: 20, // (10 - 1 + 1) + (8 + 2) = 10 + 10
    });
  });

  it('should handle character with no races', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: {
        STR: 10,
      },
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
      mainSkills: [
        { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      ],
      stats: [
        {
          id: 'health',
          name: 'Health',
          description: 'Hit points',
          formula: 'STR * 10',
        },
      ],
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

    const result = calculateCharacterStats(character, config);

    expect(result).toEqual({
      health: 100, // 10 * 10
    });
  });
});
