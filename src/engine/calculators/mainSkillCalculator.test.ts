/**
 * Main Skill Calculator Tests
 * 
 * Tests for main skill calculation including racial bonuses.
 */

import { describe, it, expect } from 'vitest';
import { calculateTotalMainSkillLevels } from './mainSkillCalculator';
import type { Character } from '../../types/character';
import type { Race } from '../../types/config';

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
