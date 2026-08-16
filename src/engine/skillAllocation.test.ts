/**
 * Stat Point Allocation Validator Tests
 *
 * **Validates: Concept 01; Requirements 2.4, 11.3**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import { validateStatAllocation } from './skillAllocation';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 6,
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
        id: 'CON',
        name: 'Constitution',
        abbreviation: 'CON',
        description: '',
        order: 2,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
    ],
    skills: [],
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

describe('validateStatAllocation', () => {
  it('should accept an allocation under the budget and report what is left', () => {
    const result = validateStatAllocation({ STR: 5, DEX: 4, CON: 2 }, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(11);
    expect(result.pointBudget).toBe(15);
    expect(result.pointsRemaining).toBe(4);
    expect(result.isOverBudget).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('should accept an allocation exactly at the budget', () => {
    const result = validateStatAllocation({ STR: 10, DEX: 5 }, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(15);
    expect(result.pointsRemaining).toBe(0);
    expect(result.isOverBudget).toBe(false);
  });

  it('should reject an allocation one point over the budget', () => {
    const result = validateStatAllocation({ STR: 10, DEX: 6 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.pointsSpent).toBe(16);
    expect(result.pointsRemaining).toBe(-1);
    expect(result.isOverBudget).toBe(true);
    // Over budget is not a per-skill problem
    expect(result.violations).toEqual([]);
  });

  it('should reject points put into a derived stat, which computes its own value', () => {
    // Replaces the old per-skill `maxLevel` rule: an investment cap and a value clamp were never
    // the same thing, and the unified stat clamps the *value* (TICKET-STAT-01)
    const config = createConfig();
    config.stats[2] = { ...config.stats[2], formula: 'STR + DEX' };

    const result = validateStatAllocation({ CON: 6 }, config);

    expect(result.isValid).toBe(false);
    expect(result.isOverBudget).toBe(false);
    expect(result.violations).toEqual([
      { statId: 'CON', statName: 'Constitution', points: 6, reason: 'derived-stat' },
    ]);
  });

  it('should treat an absent budget as unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: undefined });

    const result = validateStatAllocation({ STR: 10, DEX: 10, CON: 5 }, config);

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(25);
    expect(result.pointBudget).toBeNull();
    expect(result.pointsRemaining).toBeNull();
    expect(result.isOverBudget).toBe(false);
  });

  it('should still reject a negative allocation when the budget is unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: undefined });

    const result = validateStatAllocation({ STR: -1 }, config);

    expect(result.isValid).toBe(false);
    expect(result.violations[0].reason).toBe('negative-points');
  });

  it('should accept an empty allocation, spending nothing', () => {
    const result = validateStatAllocation({}, createConfig());

    expect(result.isValid).toBe(true);
    expect(result.pointsSpent).toBe(0);
    expect(result.pointsRemaining).toBe(15);
    expect(result.violations).toEqual([]);
  });

  it('should treat a budget of zero as "no points to spend", not as unlimited', () => {
    const config = createConfig({ mainSkillPointBudget: 0 });

    expect(validateStatAllocation({}, config).isValid).toBe(true);

    const spent = validateStatAllocation({ STR: 1 }, config);
    expect(spent.isValid).toBe(false);
    expect(spent.pointBudget).toBe(0);
    expect(spent.isOverBudget).toBe(true);
  });

  it('should reject a negative level and not let it refund points', () => {
    const result = validateStatAllocation({ STR: 10, DEX: -3 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.pointsSpent).toBe(10); // the -3 is not subtracted
    expect(result.violations).toEqual([
      { statId: 'DEX', statName: 'Dexterity', points: -3, reason: 'negative-points' },
    ]);
  });

  it('should report ids the configuration does not define, without spending on them', () => {
    const result = validateStatAllocation({ STR: 5, WIS: 4 }, createConfig());

    expect(result.isValid).toBe(false);
    expect(result.unknownStatIds).toEqual(['WIS']);
    expect(result.pointsSpent).toBe(5);
  });

  it('should report every violation, not just the first', () => {
    const result = validateStatAllocation({ STR: -1, DEX: -2, CON: -3 }, createConfig());

    expect(result.violations.map((violation) => violation.statId)).toEqual(['STR', 'DEX', 'CON']);
  });
});
