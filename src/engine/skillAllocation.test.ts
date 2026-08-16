/**
 * Stat Point Allocation Validator Tests
 *
 * The budget is derived since TICKET-RES-02 — `level × const.points_per_level` — so these cover the
 * two inputs that move it (experience and the constant) as well as the boundaries SKL-01's flat
 * pool had: exactly at budget valid, one over invalid.
 *
 * **Validates: Concept 06; Concept 05; Concept 01; Requirements 2.4, 11.3**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration, Constant, Curve } from '../types/config';
import { isFormulaError } from './formula/errors';
import { validateStatAllocation } from './skillAllocation';

/**
 * The seeded XP table: level 1 at 0 XP, 2 at 300, 3 at 900, 4 at 2700
 *
 * The same fixture `characterSummary.test.ts` uses, because the budget is priced off exactly the
 * level that module reads.
 */
function xpCurve(overrides: Partial<Curve> = {}): Curve {
  return {
    id: 'curve-xp',
    name: 'xp_thresholds',
    displayName: 'XP thresholds',
    description: '',
    keyName: 'level',
    columns: [{ id: 'curve-xp-col', name: 'xp_required' }],
    rows: [
      { key: 1, values: [0] },
      { key: 2, values: [300] },
      { key: 3, values: [900] },
      { key: 4, values: [2700] },
    ],
    interpolation: 'step',
    outOfRange: 'extrapolate',
    lookupDirection: 'reverse',
    ...overrides,
  };
}

function pointsPerLevel(value: number): Constant {
  return {
    id: 'const-ppl',
    name: 'points_per_level',
    displayName: 'Points per level',
    description: '',
    value,
  };
}

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 7,
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
    // 5 points per level, so level 3 buys 15 — the number SKL-01's flat pool used to be set to
    constants: [pointsPerLevel(5)],
    curves: [xpCurve()],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** A character at level 3 by default — 900 XP against the fixture curve */
function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Test Character',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 900,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** Allocate points at the default level 3 */
function allocate(investedStatPoints: Record<string, number>, config = createConfig()) {
  return validateStatAllocation(createCharacter({ investedStatPoints }), config);
}

describe('validateStatAllocation', () => {
  describe('the derived budget', () => {
    it('should price the pool as level × points_per_level', () => {
      const result = allocate({ STR: 5, DEX: 4, CON: 2 });

      expect(result.isValid).toBe(true);
      expect(result.pointsSpent).toBe(11);
      expect(result.pointBudget).toBe(15);
      expect(result.pointsRemaining).toBe(4);
      expect(result.isOverBudget).toBe(false);
      expect(result.violations).toEqual([]);
    });

    it.each([
      [0, 1, 5],
      [300, 2, 10],
      [900, 3, 15],
      [2700, 4, 20],
    ])(
      'should move the budget with the level: %i XP is level %i, worth %i points',
      (experience, _level, budget) => {
        const result = validateStatAllocation(createCharacter({ experience }), createConfig());

        expect(result.pointBudget).toBe(budget);
      }
    );

    it('should move the budget when the constant changes, at an unchanged level', () => {
      const cheaper = createConfig({ constants: [pointsPerLevel(2)] });

      expect(validateStatAllocation(createCharacter(), cheaper).pointBudget).toBe(6);
    });

    it('should fall back to Concept 05’s seeded 3 when the ruleset names no such constant', () => {
      const bare = createConfig({ constants: [] });

      expect(validateStatAllocation(createCharacter(), bare).pointBudget).toBe(9);
    });

    it('should validate a character at creation against level-at-XP-0’s budget', () => {
      // The draft the wizard passes: no experience earned yet, so the pool is level 1's
      const fresh = createCharacter({ experience: 0, investedStatPoints: { STR: 5 } });

      const result = validateStatAllocation(fresh, createConfig());

      expect(result.pointBudget).toBe(5);
      expect(result.pointsRemaining).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it('should treat a budget of zero as “no points to spend”, not as unlimited', () => {
      const noPoints = createConfig({ constants: [pointsPerLevel(0)] });

      expect(validateStatAllocation(createCharacter(), noPoints).isValid).toBe(true);

      const spent = validateStatAllocation(
        createCharacter({ investedStatPoints: { STR: 1 } }),
        noPoints
      );
      expect(spent.pointBudget).toBe(0);
      expect(spent.isValid).toBe(false);
      expect(spent.isOverBudget).toBe(true);
    });
  });

  describe('the boundaries, preserved from TICKET-SKL-01', () => {
    it('should accept an allocation exactly at the budget', () => {
      const result = allocate({ STR: 10, DEX: 5 });

      expect(result.isValid).toBe(true);
      expect(result.pointsSpent).toBe(15);
      expect(result.pointsRemaining).toBe(0);
      expect(result.isOverBudget).toBe(false);
    });

    it('should reject an allocation one point over the budget', () => {
      const result = allocate({ STR: 10, DEX: 6 });

      expect(result.isValid).toBe(false);
      expect(result.pointsSpent).toBe(16);
      expect(result.pointsRemaining).toBe(-1);
      expect(result.isOverBudget).toBe(true);
      // Over budget is not a per-stat problem
      expect(result.violations).toEqual([]);
    });

    it('should accept an empty allocation, spending nothing', () => {
      const result = allocate({});

      expect(result.isValid).toBe(true);
      expect(result.pointsSpent).toBe(0);
      expect(result.pointsRemaining).toBe(15);
      expect(result.violations).toEqual([]);
    });
  });

  describe('a budget that cannot be derived', () => {
    it('should carry the level’s error rather than substituting a number', () => {
      const noCurve = createConfig({ curves: [] });

      const result = validateStatAllocation(createCharacter(), noCurve);

      expect(isFormulaError(result.pointBudget)).toBe(true);
      expect(isFormulaError(result.pointsRemaining)).toBe(true);
    });

    it('should be invalid rather than unlimited — an unpriceable pool is not a licence to spend', () => {
      const noCurve = createConfig({ curves: [] });

      const result = validateStatAllocation(
        createCharacter({ investedStatPoints: { STR: 1 } }),
        noCurve
      );

      expect(result.isValid).toBe(false);
      // Not *over* budget: there is no budget to be over, which is a different thing to report
      expect(result.isOverBudget).toBe(false);
      expect(result.violations).toEqual([]);
    });

    it('should still count what was spent, so the surfaces can say what is on the sheet', () => {
      const noCurve = createConfig({ curves: [] });

      expect(
        validateStatAllocation(createCharacter({ investedStatPoints: { STR: 4 } }), noCurve)
          .pointsSpent
      ).toBe(4);
    });
  });

  describe('per-stat violations', () => {
    it('should reject points put into a derived stat, which computes its own value', () => {
      // Replaces the old per-skill `maxLevel` rule: an investment cap and a value clamp were never
      // the same thing, and the unified stat clamps the *value* (TICKET-STAT-01)
      const config = createConfig();
      config.stats[2] = { ...config.stats[2], formula: 'STR + DEX' };

      const result = allocate({ CON: 6 }, config);

      expect(result.isValid).toBe(false);
      expect(result.isOverBudget).toBe(false);
      expect(result.violations).toEqual([
        { statId: 'CON', statName: 'Constitution', points: 6, reason: 'derived-stat' },
      ]);
    });

    it('should reject a negative allocation and not let it refund points', () => {
      const result = allocate({ STR: 10, DEX: -3 });

      expect(result.isValid).toBe(false);
      expect(result.pointsSpent).toBe(10); // the -3 is not subtracted
      expect(result.violations).toEqual([
        { statId: 'DEX', statName: 'Dexterity', points: -3, reason: 'negative-points' },
      ]);
    });

    it('should report ids the configuration does not define, without spending on them', () => {
      const result = allocate({ STR: 5, WIS: 4 });

      expect(result.isValid).toBe(false);
      expect(result.unknownStatIds).toEqual(['WIS']);
      expect(result.pointsSpent).toBe(5);
    });

    it('should report every violation, not just the first', () => {
      const result = allocate({ STR: -1, DEX: -2, CON: -3 });

      expect(result.violations.map((violation) => violation.statId)).toEqual(['STR', 'DEX', 'CON']);
    });
  });
});
