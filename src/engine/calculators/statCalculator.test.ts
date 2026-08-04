/**
 * Stat Calculator Tests
 *
 * Tests for stat calculation from formulas.
 */

import { describe, expect, it } from 'vitest';
import type { Stat } from '../../types/config';
import { isFormulaError } from '../formula/errors';
import { calculateMaxStatValues } from './statCalculator';

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

  // TICKET-FORM-05 changed the contract: a broken formula is an error **value** naming the
  // stat, not a throw that takes the whole calculation with it.
  it('should return an error value naming the stat for an undefined variable', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * 10 + MISSING * 5',
      },
    ];

    const result = calculateMaxStatValues(stats, { STR: 10 });

    expect(result.health).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: MISSING',
      source: { kind: 'stat', id: 'health', name: 'Health' },
    });
  });

  it('should return an error value naming the stat for invalid formula syntax', () => {
    const stats: Stat[] = [
      {
        id: 'health',
        name: 'Health',
        description: 'Hit points',
        formula: 'STR * * 10', // Invalid syntax
      },
    ];

    const result = calculateMaxStatValues(stats, { STR: 10 });

    expect(result.health).toMatchObject({
      kind: 'syntax',
      source: { kind: 'stat', name: 'Health' },
    });
  });

  it('should calculate every other stat when one formula is broken', () => {
    const stats: Stat[] = [
      { id: 'health', name: 'Health', description: '', formula: 'MISSING * 5' },
      { id: 'armour', name: 'Armour', description: '', formula: 'STR * 2' },
    ];

    const result = calculateMaxStatValues(stats, { STR: 10 });

    expect(result.armour).toBe(20);
    expect(isFormulaError(result.health)).toBe(true);
  });
});
