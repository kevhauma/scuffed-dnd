/**
 * Point Allocation Validator Tests
 *
 * The budget is derived since TICKET-RES-02 — `level × const.points_per_level` — so these cover the
 * two inputs that move it (experience and the constant) as well as the boundaries SKL-01's flat
 * pool had: exactly at budget valid, one over invalid.
 *
 * Since TICKET-RES-05 the spend it is measured against is the **sum of the stat boxes and the skill
 * boxes**, which is the source sheet's own `Points Spend` — so the cases below cover both orderings
 * of reaching one overspend and the readout pair the sheet header prints.
 *
 * **Validates: Concept 06; Concept 05; Concept 01; Requirements 2.4, 11.3; v4 systems/02 gaps 3-4**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../types/character';
import type { Archetype, Configuration, Constant, Curve } from '../types/config';
import { isFormulaError } from './formula/errors';
import { SKILL_ALLOCATION_VIOLATION, validateStatAllocation } from './skillAllocation';

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
    schemaVersion: 9,
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
    // The pool pays for these too since TICKET-RES-05, so the fixture defines some
    skills: [
      { id: 'stealth', name: 'Stealth', description: '', statWeights: [] },
      { id: 'alchemy', name: 'Alchemy', description: '', statWeights: [] },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    // 5 points per level, so level 3 buys 15 — the number SKL-01's flat pool used to be set to
    constants: [pointsPerLevel(5)],
    curves: [xpCurve()],
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

  describe("the DM's grant (TICKET-DM-01)", () => {
    it('should add to the derived pool rather than replacing it', () => {
      const granted = createCharacter({ grantedStatPoints: 4 });

      expect(validateStatAllocation(granted, createConfig()).pointBudget).toBe(19);
      expect(validateStatAllocation(granted, createConfig()).grantedPoints).toBe(4);
    });

    it('should keep moving the pool with the level underneath the grant', () => {
      // The whole reason a grant is not a stored budget: award experience and both terms still hold
      const levelled = createCharacter({ experience: 900, grantedStatPoints: 4 });

      expect(validateStatAllocation(levelled, createConfig()).pointBudget).toBe(19);
    });

    it('should read an absent grant as none', () => {
      expect(validateStatAllocation(createCharacter(), createConfig()).grantedPoints).toBe(0);
      expect(validateStatAllocation(createCharacter(), createConfig()).pointBudget).toBe(15);
    });

    it('should make a spend the derived pool could not cover affordable', () => {
      const spent = { STR: 18 };

      expect(
        validateStatAllocation(createCharacter({ investedStatPoints: spent }), createConfig())
          .isValid
      ).toBe(false);
      expect(
        validateStatAllocation(
          createCharacter({ investedStatPoints: spent, grantedStatPoints: 4 }),
          createConfig()
        ).isValid
      ).toBe(true);
    });

    it('should ignore a stored grant that is not a usable number rather than poisoning the pool', () => {
      // A `NaN` here would make the whole budget `NaN`, which is a `number` as far as
      // `isFormulaError` is concerned — the silently-wrong value Concept 00 §7 forbids
      const broken = createCharacter({ grantedStatPoints: Number.NaN });

      expect(validateStatAllocation(broken, createConfig()).pointBudget).toBe(15);
      expect(validateStatAllocation(broken, createConfig()).grantedPoints).toBe(0);
    });

    it('should not rescue a pool that cannot be derived at all', () => {
      const noCurve = createConfig({ curves: [] });
      const granted = createCharacter({ grantedStatPoints: 4 });

      expect(isFormulaError(validateStatAllocation(granted, noCurve).pointBudget)).toBe(true);
      expect(validateStatAllocation(granted, noCurve).isValid).toBe(false);
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

  /**
   * One pool for stats and skills (TICKET-RES-05)
   *
   * The sheet's own arithmetic: `Points to Use = level × 3 − Points Spend`, where Points Spend sums
   * the stat boxes and all 48 skill boxes together.
   */
  describe('the shared pool', () => {
    it('should sum the stat boxes and the skill boxes into one spend', () => {
      const both = createCharacter({
        investedStatPoints: { STR: 5 },
        investedSkillPoints: { stealth: 4 },
      });
      const config = createConfig();

      const result = validateStatAllocation(both, config);

      expect(result.pointsSpent).toBe(9);
      expect(result.pointsRemaining).toBe(6);
      expect(result.isValid).toBe(true);
    });

    it('should refuse a total the pool cannot cover though each half would fit alone', () => {
      const both = createCharacter({
        investedStatPoints: { STR: 10 },
        investedSkillPoints: { stealth: 6 },
      });
      const config = createConfig();

      const result = validateStatAllocation(both, config);

      expect(result.pointsSpent).toBe(16);
      expect(result.pointsRemaining).toBe(-1);
      expect(result.isOverBudget).toBe(true);
      expect(result.isValid).toBe(false);
      // Over budget is not a per-entry problem, on either side
      expect(result.violations).toEqual([]);
      expect(result.skillViolations).toEqual([]);
    });

    it('should reach the same verdict whichever side the last point went into', () => {
      // stat-then-skill and skill-then-stat: the pool is a sum, so the order cannot matter — and
      // both refusals name the same one-point overspend
      const statLast = createCharacter({
        investedStatPoints: { STR: 10, DEX: 1 },
        investedSkillPoints: { stealth: 5 },
      });
      const skillLast = createCharacter({
        investedStatPoints: { STR: 10 },
        investedSkillPoints: { stealth: 5, alchemy: 1 },
      });
      const config = createConfig();

      for (const character of [statLast, skillLast]) {
        const result = validateStatAllocation(character, config);

        expect(result.pointsSpent).toBe(16);
        expect(result.pointsRemaining).toBe(-1);
        expect(result.isValid).toBe(false);
      }
    });

    it('should sum across several skills rather than reading only the largest', () => {
      const spread = createCharacter({ investedSkillPoints: { stealth: 8, alchemy: 8 } });
      const config = createConfig();

      const result = validateStatAllocation(spread, config);

      expect(result.pointsSpent).toBe(16);
    });

    it('should charge nothing for points against a skill the ruleset does not define', () => {
      // `skillCalculator` walks `config.skills`, so these raise the level of nothing — charging the
      // pool for them would take a Player's budget for something no surface can show them
      const stale = createCharacter({ investedSkillPoints: { 'skill-gone': 40 } });
      const config = createConfig();

      const result = validateStatAllocation(stale, config);

      expect(result.pointsSpent).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it('should report a negative skill spend rather than letting it refund the pool', () => {
      const refunder = createCharacter({
        investedStatPoints: { STR: 15 },
        investedSkillPoints: { stealth: -5 },
      });
      const config = createConfig();

      const result = validateStatAllocation(refunder, config);

      expect(result.pointsSpent).toBe(15);
      expect(result.skillViolations).toEqual([
        {
          skillId: 'stealth',
          skillName: 'Stealth',
          points: -5,
          reason: SKILL_ALLOCATION_VIOLATION.NEGATIVE_POINTS,
        },
      ]);
      expect(result.isValid).toBe(false);
    });

    it('should report an allocation the widened pool can no longer afford, not rewrite it', () => {
      // Every character built while skill investment was free is one of these. RES-02's treatment:
      // the numbers stay exactly as stored and the verdict says they do not fit.
      const legacy = createCharacter({ investedSkillPoints: { stealth: 20 } });
      const config = createConfig();

      const result = validateStatAllocation(legacy, config);

      expect(result.isOverBudget).toBe(true);
      expect(result.pointsSpent).toBe(20);
      expect(legacy.investedSkillPoints.stealth).toBe(20);
    });

    it("should let the DM's grant pay for a skill spend, like any other", () => {
      const granted = createCharacter({
        investedSkillPoints: { stealth: 18 },
        grantedStatPoints: 4,
      });
      const config = createConfig();

      const result = validateStatAllocation(granted, config);

      expect(result.isValid).toBe(true);
    });

    /**
     * The pair the sheet header prints (`Character Sheet` K1:L3)
     *
     * The workbook's sample character: level 1, three points spent, none left to use — against the
     * seeded `points_per_level` of 3 rather than this file's fixture 5.
     */
    it('should report the sample sheet’s Points Spend and Points to Use', () => {
      const seeded = createConfig({ constants: [] });
      const sample = createCharacter({ experience: 0, investedStatPoints: { STR: 3 } });

      const result = validateStatAllocation(sample, seeded);

      expect(result.pointBudget).toBe(3);
      expect(result.pointsSpent).toBe(3);
      expect(result.pointsRemaining).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it('should count a skill point against that same pair', () => {
      const seeded = createConfig({ constants: [] });
      const sample = createCharacter({
        experience: 0,
        investedStatPoints: { STR: 2 },
        investedSkillPoints: { stealth: 1 },
      });

      const result = validateStatAllocation(sample, seeded);

      expect(result.pointsSpent).toBe(3);
      expect(result.pointsRemaining).toBe(0);
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

  /**
   * What the points bought, not just how many were spent (Concept 03, TICKET-ARC-02) — so the
   * wizard and the sheet render "7 points in Char → +9" from the engine rather than looking the
   * curve up themselves.
   */
  describe('per-stat gains', () => {
    /** The three keys these cases read, from the seeded table */
    const pointBuy: Curve = {
      id: 'curve-point-buy',
      name: 'point_buy',
      displayName: 'Point buy',
      description: '',
      keyName: 'points',
      columns: [
        { id: 'col-non', name: 'non' },
        { id: 'col-sub', name: 'sub' },
        { id: 'col-main', name: 'main' },
      ],
      rows: [
        { key: 0, values: [0, 0, 0] },
        { key: 5, values: [2, 3, 4.5] },
        { key: 10, values: [4, 5, 8.25] },
      ],
      interpolation: 'step',
      outOfRange: 'error',
      lookupDirection: 'forward',
    };

    const archetype: Archetype = {
      id: 'strong',
      name: 'Strong',
      description: '',
      // CON untagged, so the mixed spread covers all three columns
      statAffinity: { STR: 'main', DEX: 'sub' },
    };

    const withArchetype = (overrides: Partial<Configuration> = {}) =>
      createConfig({ curves: [xpCurve(), pointBuy], archetypes: [archetype], ...overrides });

    const gainsOf = (character: Character, config = withArchetype()) =>
      Object.fromEntries(
        validateStatAllocation(character, config).gains.map((row) => [row.statId, row])
      );

    it('should report what each stat’s spend bought, through its own column', () => {
      const rows = gainsOf(
        createCharacter({
          archetypeId: 'strong',
          investedStatPoints: { STR: 10, DEX: 10, CON: 10 },
        })
      );

      // DEX reads the table's 5 plus the neutral dream level, added flat to a sub-tagged stat
      // (TICKET-ARC-04); STR's main column is multiplied by it, which at 1 leaves it alone
      expect(rows.STR).toMatchObject({ affinity: 'main', points: 10, gain: 8.25 });
      expect(rows.DEX).toMatchObject({ affinity: 'sub', points: 10, gain: 6 });
      expect(rows.CON).toMatchObject({ affinity: 'non', points: 10, gain: 4 });
    });

    it('should handle a mixed allocation, pricing each stat at its own key', () => {
      const rows = gainsOf(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 5, DEX: 10 } })
      );

      expect(rows.STR.gain).toBe(4.5);
      expect(rows.DEX.gain).toBe(6);
      // Untouched and untagged: the dream reaches neither the `non` column nor a zero spend there
      expect(rows.CON.gain).toBe(0);
    });

    it('should name the stat, so a caller renders a row without a second lookup', () => {
      const rows = gainsOf(createCharacter({ investedStatPoints: { STR: 5 } }));

      expect(rows.STR.statName).toBe('Strength');
    });

    it('should include every investable stat, including the untouched ones', () => {
      const result = validateStatAllocation(createCharacter(), withArchetype());

      // "You have spent nothing here" is a thing a Player allocating points needs to see
      expect(result.gains.map((row) => row.statId)).toEqual(['STR', 'DEX', 'CON']);
      expect(result.gains.every((row) => row.gain === 0)).toBe(true);
    });

    it('should leave a derived stat out — nothing a point could buy in it', () => {
      const config = withArchetype();
      config.stats = config.stats.map((stat) =>
        stat.id === 'CON' ? { ...stat, formula: 'STR + DEX' } : stat
      );

      expect(
        validateStatAllocation(createCharacter(), config).gains.map((row) => row.statId)
      ).toEqual(['STR', 'DEX']);
    });

    it('should route every stat through non for a character with no archetype', () => {
      const rows = gainsOf(createCharacter({ investedStatPoints: { STR: 10, DEX: 10 } }));

      expect(rows.STR).toMatchObject({ affinity: 'non', gain: 4 });
      expect(rows.DEX).toMatchObject({ affinity: 'non', gain: 4 });
    });

    it('should carry the curve’s error rather than a number it did not derive', () => {
      const rows = gainsOf(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40 } })
      );

      expect(isFormulaError(rows.STR.gain)).toBe(true);
    });

    it('should refuse an allocation the table cannot price, rather than letting it be saved', () => {
      // Otherwise the store persists it and the stat renders as an error chip with nothing having
      // refused — the state RES-02's "an unpriceable pool is not a licence to spend" prevents, met
      // again per stat (found by the conventions-reviewer on this ticket)
      const result = validateStatAllocation(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40 } }),
        withArchetype()
      );

      expect(result.isValid).toBe(false);
      expect(result.violations).toEqual([
        { statId: 'STR', statName: 'Strength', points: 40, reason: 'unpriceable-gain' },
      ]);
    });

    it('should still count an unpriceable spend towards the budget', () => {
      // They *were* spent; reporting "0 of 15" while the Player looks at 40 in a box would be the
      // wrong number to argue with
      const result = validateStatAllocation(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40 } }),
        withArchetype()
      );

      expect(result.pointsSpent).toBe(40);
    });

    it('should report a negative allocation as negative-points, not as unpriceable', () => {
      const result = validateStatAllocation(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: -3 } }),
        withArchetype()
      );

      expect(result.violations.map((violation) => violation.reason)).toEqual(['negative-points']);
    });

    it('should still price the stats the table can answer for', () => {
      const rows = gainsOf(
        createCharacter({ archetypeId: 'strong', investedStatPoints: { STR: 40, DEX: 10 } })
      );

      expect(rows.DEX.gain).toBe(6);
    });

    it('should report the dream level in the gain the Player is shown (TICKET-ARC-04)', () => {
      // The readout and the sheet read the same engine, so what a Player is told a point buys
      // already carries the dream their character stands at
      const dreamer = createCharacter({
        archetypeId: 'strong',
        dreamLevel: 3,
        investedStatPoints: { STR: 10, DEX: 10, CON: 10 },
      });
      const rows = gainsOf(dreamer);

      expect(rows.STR.gain).toBeCloseTo(24.75, 10);
      expect(rows.DEX.gain).toBe(8);
      expect(rows.CON.gain).toBe(4);
    });

    it('should grant a sub-tagged stat the dream level with nothing spent in it', () => {
      const unspent = createCharacter({ archetypeId: 'strong', dreamLevel: 2 });
      const rows = gainsOf(unspent);

      expect(rows.DEX.gain).toBe(2);
      expect(rows.CON.gain).toBe(0);
    });

    it('should fall back to 1:1 for a ruleset with no point_buy curve', () => {
      const rows = gainsOf(
        createCharacter({ investedStatPoints: { STR: 10 } }),
        createConfig({ curves: [xpCurve()] })
      );

      expect(rows.STR.gain).toBe(10);
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
