/**
 * Calculation Engine Tests
 * 
 * Tests for the main calculator convenience function.
 * Individual calculator tests are in their respective files.
 */

import { describe, it, expect } from 'vitest';
import { calculateCharacterStats } from './calculator';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';

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
