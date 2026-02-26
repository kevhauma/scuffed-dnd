/**
 * Stat Calculator Tests
 * 
 * Tests for stat calculation from formulas.
 */

import { describe, it, expect } from 'vitest';
import { calculateMaxStatValues } from './statCalculator';
import type { Stat } from '../../types/config';

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
