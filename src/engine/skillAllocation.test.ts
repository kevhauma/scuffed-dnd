/**
 * Main Skill Allocation Validator Tests
 *
 * **Validates: Requirements 2.4, 11.3**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import { validateMainSkillAllocation } from './skillAllocation';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 10 },
      { code: 'CON', name: 'Constitution', description: '', maxLevel: 5 },
    ],
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
    mainSkillPointBudget: 15,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('validateMainSkillAllocation', () => {
  it('should accept an allocation under the budget and report what is left', () => {
    const result = validateMainSkillAllocation({ STR: 5, DEX: 4, CON: 2 }, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(11);
    expect(result.pointBudget).toBe(15);
    expect(result.pointsRemaining).toBe(4);
    expect(result.isOverBudget).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('should accept an allocation exactly at the budget', () => {
    const result = validateMainSkillAllocation({ STR: 10, DEX: 5 }, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(15);
    expect(result.pointsRemaining).toBe(0);
    expect(result.isOverBudget).toBe(false);
  });

  it('should reject an allocation one point over the budget', () => {
    const result = validateMainSkillAllocation({ STR: 10, DEX: 6 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.pointsSpent).toBe(16);
    expect(result.pointsRemaining).toBe(-1);
    expect(result.isOverBudget).toBe(true);
    // Over budget is not a per-skill problem
    expect(result.violations).toEqual([]);
  });

  it('should reject a skill above its own max level even with budget to spare', () => {
    const result = validateMainSkillAllocation({ CON: 6 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.isOverBudget).toBe(false);
    expect(result.pointsRemaining).toBe(9);
    expect(result.violations).toEqual([
      {
        skillCode: 'CON',
        skillName: 'Constitution',
        level: 6,
        maxLevel: 5,
        reason: 'above-max-level',
      },
    ]);
  });

  it('should treat an absent budget as unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: undefined });

    const result = validateMainSkillAllocation({ STR: 10, DEX: 10, CON: 5 }, config);

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(25);
    expect(result.pointBudget).toBeNull();
    expect(result.pointsRemaining).toBeNull();
    expect(result.isOverBudget).toBe(false);
  });

  it('should still enforce per-skill maximums when the budget is unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: undefined });

    const result = validateMainSkillAllocation({ STR: 11 }, config);

    expect(result.isValid).toBe(false);
    expect(result.violations[0].reason).toBe('above-max-level');
  });

  it('should accept an empty allocation, spending nothing', () => {
    const result = validateMainSkillAllocation({}, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(0);
    expect(result.pointsRemaining).toBe(15);
    expect(result.violations).toEqual([]);
  });

  it('should treat a budget of zero as "no points to spend", not as unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: 0 });

    expect(validateMainSkillAllocation({}, config).isValid).toBe(true);

    const spent = validateMainSkillAllocation({ STR: 1 }, config);
    expect(spent.isValid).toBe(false);
    expect(spent.pointBudget).toBe(0);
    expect(spent.isOverBudget).toBe(true);
  });

  it('should reject a negative level and not let it refund points', () => {
    const result = validateMainSkillAllocation({ STR: 10, DEX: -3 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.pointsSpent).toBe(10); // the -3 is not subtracted
    expect(result.violations).toEqual([
      {
        skillCode: 'DEX',
        skillName: 'Dexterity',
        level: -3,
        maxLevel: 10,
        reason: 'negative-level',
      },
    ]);
  });

  it('should report codes the configuration does not define, without spending on them', () => {
    const result = validateMainSkillAllocation({ STR: 5, WIS: 4 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.unknownSkillCodes).toEqual(['WIS']);
    expect(result.pointsSpent).toBe(5);
  });

  it('should report every violation, not just the first', () => {
    const result = validateMainSkillAllocation({ STR: 11, DEX: 12, CON: 6 }, createConfig());

    expect(result.violations.map((v) => v.skillCode)).toEqual(['STR', 'DEX', 'CON']);
    expect(result.isOverBudget).toBe(true);
  });
});
