/**
 * Main Skill Calculator Tests
 *
 * Tests for main skill calculation including racial bonuses.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { MainSkill, Race } from '../../types/config';
import {
  calculateRacialSkillModifiers,
  calculateTotalMainSkillLevels,
} from './mainSkillCalculator';

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

  describe('with equipment and focus options', () => {
    const mainSkills: MainSkill[] = [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
    ];

    const createCharacter = (overrides: Partial<Character> = {}): Character => ({
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      mainSkillLevels: { STR: 10, DEX: 8 },
      specialitySkillBaseLevels: {},
      currentStatValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      ...overrides,
    });

    it('should add equipment bonuses that target a main skill', () => {
      const result = calculateTotalMainSkillLevels(createCharacter(), [], {
        mainSkills,
        equipmentBonuses: [{ skillCode: 'STR', modifier: 2 }],
      });

      expect(result).toEqual({ STR: 12, DEX: 8 });
    });

    it('should ignore equipment bonuses that target another kind of skill', () => {
      const result = calculateTotalMainSkillLevels(createCharacter(), [], {
        mainSkills,
        // STL is a speciality skill and MEL a combat skill — neither belongs here
        equipmentBonuses: [
          { skillCode: 'STL', modifier: 4 },
          { skillCode: 'MEL', modifier: 5 },
        ],
      });

      expect(result).toEqual({ STR: 10, DEX: 8 });
    });

    it('should apply the focus stat bonus when the focus stat is a main skill', () => {
      const result = calculateTotalMainSkillLevels(createCharacter({ focusStatCode: 'DEX' }), [], {
        mainSkills,
        focusStatBonusLevel: 3,
      });

      expect(result).toEqual({ STR: 10, DEX: 11 });
    });

    it('should not apply the focus stat bonus when the focus stat is not a main skill', () => {
      const result = calculateTotalMainSkillLevels(createCharacter({ focusStatCode: 'STL' }), [], {
        mainSkills,
        focusStatBonusLevel: 3,
      });

      expect(result).toEqual({ STR: 10, DEX: 8 });
    });
  });
});

describe('calculateRacialSkillModifiers', () => {
  it('should return an empty record when there are no races', () => {
    expect(calculateRacialSkillModifiers([])).toEqual({});
  });

  it('should sum modifiers across races so the racial contribution is displayable on its own', () => {
    const races: Race[] = [
      {
        id: 'elf',
        name: 'Elf',
        description: '',
        skillModifiers: [
          { skillCode: 'DEX', modifier: 2 },
          { skillCode: 'STR', modifier: -1 },
        ],
      },
      {
        id: 'human',
        name: 'Human',
        description: '',
        skillModifiers: [{ skillCode: 'STR', modifier: 1 }],
      },
    ];

    expect(calculateRacialSkillModifiers(races)).toEqual({ STR: 0, DEX: 2 });
  });
});
