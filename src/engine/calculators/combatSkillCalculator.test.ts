/**
 * Combat Skill Bonus Calculator Tests
 *
 * Tests for combat skill bonus calculation including formula evaluation and equipment bonuses.
 */

import { describe, expect, it } from 'vitest';
import type { Configuration, SkillModifier } from '../../types/config';
import { calculateCombatSkillBonuses } from './combatSkillCalculator';

describe('calculateCombatSkillBonuses', () => {
  it('should calculate combat skill bonus from formula referencing main skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + 5', // 10 + 5 = 15
        },
      ],
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

    const specialitySkillLevels = {};
    const equipmentBonuses: SkillModifier[] = [];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 15, // 10 (STR) + 5
    });
  });

  it('should calculate combat skill bonus from formula referencing speciality skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
          id: 'SWD',
          code: 'SWD',
          name: 'Swordsmanship',
          description: 'Sword skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + SWD', // 10 + 15 = 25
        },
      ],
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

    const specialitySkillLevels = {
      SWD: 15, // Calculated speciality skill level
    };

    const equipmentBonuses: SkillModifier[] = [];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 25, // 10 (STR) + 15 (SWD)
    });
  });

  it('should add equipment bonuses to formula bonus', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR', // 10
        },
      ],
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

    const specialitySkillLevels = {};

    const equipmentBonuses: SkillModifier[] = [
      { skillCode: 'MEL', modifier: 3 }, // +3 from weapon
      { skillCode: 'MEL', modifier: 2 }, // +2 from armor
    ];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 15, // 10 (formula) + 3 (weapon) + 2 (armor)
    });
  });

  it('should handle negative equipment bonuses (penalties)', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR', // 10
        },
      ],
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

    const specialitySkillLevels = {};

    const equipmentBonuses: SkillModifier[] = [
      { skillCode: 'MEL', modifier: 5 }, // +5 from weapon
      { skillCode: 'MEL', modifier: -2 }, // -2 penalty from cursed item
    ];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 13, // 10 (formula) + 5 (weapon) - 2 (penalty)
    });
  });

  it('should only apply equipment bonuses for matching combat skill', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR',
        },
        {
          id: 'RNG',
          code: 'RNG',
          name: 'Ranged Attack',
          description: 'Ranged combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'DEX',
        },
      ],
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

    const specialitySkillLevels = {};

    const equipmentBonuses: SkillModifier[] = [
      { skillCode: 'MEL', modifier: 3 }, // +3 to melee only
      { skillCode: 'RNG', modifier: 2 }, // +2 to ranged only
      { skillCode: 'STR', modifier: 1 }, // +1 to STR (not a combat skill)
    ];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 13, // 10 (STR) + 3 (equipment)
      RNG: 10, // 8 (DEX) + 2 (equipment)
    });
  });

  it('should handle combat skill with no equipment bonuses', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR * 2',
        },
      ],
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

    const specialitySkillLevels = {};
    const equipmentBonuses: SkillModifier[] = [];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 20, // 10 * 2, no equipment bonus
    });
  });

  it('should handle multiple combat skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + 2',
        },
        {
          id: 'RNG',
          code: 'RNG',
          name: 'Ranged Attack',
          description: 'Ranged combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'DEX',
        },
        {
          id: 'MAG',
          code: 'MAG',
          name: 'Magic Attack',
          description: 'Spell attack',
          dice: { d4: 0, d6: 0, d8: 1, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'INT * 2',
        },
      ],
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

    const specialitySkillLevels = {};

    const equipmentBonuses: SkillModifier[] = [
      { skillCode: 'MEL', modifier: 3 },
      { skillCode: 'MAG', modifier: 5 },
    ];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 15, // (10 + 2) + 3
      RNG: 8, // 8 + 0
      MAG: 29, // (12 * 2) + 5
    });
  });

  it('should handle complex formula with main and speciality skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
          id: 'SWD',
          code: 'SWD',
          name: 'Swordsmanship',
          description: 'Sword skill',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: '(STR + DEX) / 2 + SWD', // (10 + 8) / 2 + 15 = 9 + 15 = 24
        },
      ],
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

    const specialitySkillLevels = {
      SWD: 15,
    };

    const equipmentBonuses: SkillModifier[] = [{ skillCode: 'MEL', modifier: 6 }];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({
      MEL: 30, // 24 (formula) + 6 (equipment)
    });
  });

  it('should return an error value naming the skill for an undefined variable', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + MISSING', // MISSING is not defined
        },
      ],
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

    const specialitySkillLevels = {};
    const equipmentBonuses: SkillModifier[] = [];

    expect(
      calculateCombatSkillBonuses(
        config,
        totalMainSkillLevels,
        specialitySkillLevels,
        equipmentBonuses
      ).MEL
    ).toMatchObject({
      kind: 'undefined-variable',
      source: { kind: 'combat-skill', name: 'Melee Attack' },
    });
  });

  it('should return an error value naming the skill for invalid formula syntax', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
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
      specialitySkills: [],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR * * 2', // Invalid syntax
        },
      ],
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

    const specialitySkillLevels = {};
    const equipmentBonuses: SkillModifier[] = [];

    expect(
      calculateCombatSkillBonuses(
        config,
        totalMainSkillLevels,
        specialitySkillLevels,
        equipmentBonuses
      ).MEL
    ).toMatchObject({
      kind: 'syntax',
      source: { kind: 'combat-skill', name: 'Melee Attack' },
    });
  });

  it('should handle empty combat skills list', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 2,
      stats: [],
      specialitySkills: [],
      combatSkills: [], // No combat skills
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

    const totalMainSkillLevels = {};
    const specialitySkillLevels = {};
    const equipmentBonuses: SkillModifier[] = [];

    const result = calculateCombatSkillBonuses(
      config,
      totalMainSkillLevels,
      specialitySkillLevels,
      equipmentBonuses
    );

    expect(result).toEqual({});
  });
});
