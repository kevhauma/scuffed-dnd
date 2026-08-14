/**
 * Combat Skill Bonus Calculator Tests
 *
 * Tests for combat skill bonus calculation.
 *
 * The equipment cases retired with TICKET-MAT-02: a tier modifier names a stat, so a combat skill
 * has no equipment term of its own — it feels equipment through the stats and speciality levels its
 * formula reads. `calculator.test.ts` pins that route end to end.
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../../types/config';
import { calculateCombatSkillBonuses } from './combatSkillCalculator';

describe('calculateCombatSkillBonuses', () => {
  it('should calculate combat skill bonus from formula referencing main skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [],
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

    const skillValues = { levels: {}, bonuses: {} };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    expect(result).toEqual({
      MEL: 15, // 10 (STR) + 5
    });
  });

  it('should calculate combat skill bonus from formula referencing speciality skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [
        {
          id: 'SWD',
          name: 'Swordsmanship',
          description: 'Sword skill',
          statWeights: [{ statId: 'STR', weight: 0.3 }],
        },
      ],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          // `skills.<name>` — a `Skill` has no code since TICKET-SKL-02
          bonusFormula: 'STR + skills.swordsmanship', // 10 + 15 = 25
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

    const skillValues = {
      levels: { SWD: 15 }, // Calculated skill level, keyed by skill id
      bonuses: { SWD: 3 },
    };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    expect(result).toEqual({
      MEL: 25, // 10 (STR) + 15 (SWD)
    });
  });

  it('should be the formula and nothing else', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [],
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

    const skillValues = { levels: {}, bonuses: {} };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    expect(result).toEqual({
      MEL: 20, // 10 * 2
    });
  });

  it('should handle multiple combat skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [],
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

    const skillValues = { levels: {}, bonuses: {} };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    // No equipment term since TICKET-MAT-02 — each bonus is its formula and nothing else
    expect(result).toEqual({
      MEL: 12, // 10 + 2
      RNG: 8,
      MAG: 24, // 12 * 2
    });
  });

  it('should handle complex formula with main and speciality skills', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [
        {
          id: 'SWD',
          name: 'Swordsmanship',
          description: 'Sword skill',
          statWeights: [{ statId: 'STR', weight: 0.3 }],
        },
      ],
      combatSkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee Attack',
          description: 'Close combat attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          // (10 + 8) / 2 + 15 = 9 + 15 = 24
          bonusFormula: '(STR + DEX) / 2 + skills.swordsmanship',
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

    const skillValues = {
      levels: { SWD: 15 },
      bonuses: { SWD: 3 },
    };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    expect(result).toEqual({
      MEL: 24, // the formula, and nothing else (TICKET-MAT-02)
    });
  });

  it('should return an error value naming the skill for an undefined variable', () => {
    const config: Configuration = {
      id: 'config1',
      name: 'Test Config',
      version: '1.0',
      schemaVersion: 5,
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
      skills: [],
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

    const skillValues = { levels: {}, bonuses: {} };

    expect(
      calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues).MEL
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
      schemaVersion: 5,
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
      skills: [],
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

    const skillValues = { levels: {}, bonuses: {} };

    expect(
      calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues).MEL
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
      schemaVersion: 5,
      stats: [],
      skills: [],
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
    const skillValues = { levels: {}, bonuses: {} };

    const result = calculateCombatSkillBonuses(config, totalMainSkillLevels, skillValues);

    expect(result).toEqual({});
  });
});
