/**
 * Speciality Skill Calculator Tests
 *
 * Tests for speciality skill calculation including base level, formula bonus, and focus stat bonus.
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration } from '../../types/config';
import { calculateSpecialitySkillLevels } from './specialitySkillCalculator';

describe('calculateSpecialitySkillLevels', () => {
  it('should calculate speciality skill with base level and formula bonus', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {
        MEL: 5, // Melee base level
      },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: '(STR + DEX) / 2', // (10 + 8) / 2 = 9
        },
      ],
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

    const totalMainSkillLevels = {
      STR: 10,
      DEX: 8,
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 14, // 5 (base) + 9 (bonus)
    });
  });

  it('should apply focus stat bonus when speciality skill is focus stat', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
      },
      focusStatCode: 'MEL', // MEL is the focus stat
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: '(STR + DEX) / 2', // (10 + 8) / 2 = 9
        },
      ],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 3, // Focus stat bonus
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const totalMainSkillLevels = {
      STR: 10,
      DEX: 8,
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 17, // 5 (base) + 9 (bonus) + 3 (focus)
    });
  });

  it('should not apply focus stat bonus when speciality skill is not focus stat', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
        RNG: 3,
      },
      focusStatCode: 'RNG', // RNG is the focus stat, not MEL
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
        {
          id: 'RNG',
          code: 'RNG',
          name: 'Ranged',
          description: 'Ranged combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'DEX',
        },
      ],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 3,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const totalMainSkillLevels = {
      STR: 10,
      DEX: 8,
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 15, // 5 (base) + 10 (bonus), no focus bonus
      RNG: 14, // 3 (base) + 8 (bonus) + 3 (focus)
    });
  });

  it('should handle speciality skill with zero base level', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
      },
      specialitySkillBaseLevels: {}, // No base levels set
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ],
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

    const totalMainSkillLevels = {
      STR: 10,
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 10, // 0 (base) + 10 (bonus)
    });
  });

  it('should handle multiple speciality skills', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
        INT: 12,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
        RNG: 3,
        MAG: 7,
      },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'INT',
          name: 'Intelligence',
          abbreviation: 'INT',
          description: '',
          order: 2,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
        {
          id: 'RNG',
          code: 'RNG',
          name: 'Ranged',
          description: 'Ranged combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'DEX',
        },
        {
          id: 'MAG',
          code: 'MAG',
          name: 'Magic',
          description: 'Spellcasting skill',
          maxBaseLevel: 10,
          bonusFormula: 'INT * 2',
        },
      ],
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

    const totalMainSkillLevels = {
      STR: 10,
      DEX: 8,
      INT: 12,
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 15, // 5 + 10
      RNG: 11, // 3 + 8
      MAG: 31, // 7 + 24
    });
  });

  it('should use racial bonuses in formula calculation', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
        DEX: 8,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
      },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR + DEX',
        },
      ],
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

    // Total main skill levels with racial bonuses already applied
    const totalMainSkillLevels = {
      STR: 12, // 10 + 2 from race
      DEX: 10, // 8 + 2 from race
    };

    const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels);

    expect(result).toEqual({
      MEL: 27, // 5 (base) + 22 (12 + 10 bonus)
    });
  });

  it('should return an error value naming the skill for an undefined variable', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
      },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR + MISSING', // MISSING is not defined
        },
      ],
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

    const totalMainSkillLevels = {
      STR: 10,
    };

    expect(
      calculateSpecialitySkillLevels(character, config, totalMainSkillLevels).MEL
    ).toMatchObject({
      kind: 'undefined-variable',
      source: { kind: 'speciality-skill', name: 'Melee' },
    });
  });

  it('should return an error value naming the skill for invalid formula syntax', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: {
        STR: 10,
      },
      specialitySkillBaseLevels: {
        MEL: 5,
      },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR * * 2', // Invalid syntax
        },
      ],
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

    const totalMainSkillLevels = {
      STR: 10,
    };

    expect(
      calculateSpecialitySkillLevels(character, config, totalMainSkillLevels).MEL
    ).toMatchObject({
      kind: 'syntax',
      source: { kind: 'speciality-skill', name: 'Melee' },
    });
  });

  describe('with equipment bonuses', () => {
    const character: Character = {
      id: '1',
      name: 'Test Character',
      configurationId: 'config1',
      raceIds: [],
      investedStatPoints: { STR: 10, DEX: 8 },
      specialitySkillBaseLevels: { STL: 5 },
      currentResourceValues: {},
      inventory: { equippedItems: {}, miscItems: [] },
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 3,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ],
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'DEX / 2', // 8 / 2 = 4
        },
      ],
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

    const totalMainSkillLevels = { STR: 10, DEX: 8 };

    it('should add equipment bonuses that target the speciality skill', () => {
      const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels, [
        { skillCode: 'STL', modifier: 3 },
      ]);

      expect(result).toEqual({ STL: 12 }); // 5 (base) + 4 (formula) + 3 (equipment)
    });

    it('should ignore equipment bonuses that target another kind of skill', () => {
      const result = calculateSpecialitySkillLevels(character, config, totalMainSkillLevels, [
        { skillCode: 'STR', modifier: 2 },
        { skillCode: 'MEL', modifier: 5 },
      ]);

      expect(result).toEqual({ STL: 9 }); // 5 (base) + 4 (formula)
    });
  });
});
