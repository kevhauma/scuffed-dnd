/**
 * Stat Calculator Tests
 *
 * The three kinds of stat through one calculator (Concept 01), plus the two invariants that make
 * the unified model safe: every configured stat has a value, and a stat the ruleset no longer
 * defines answers for nothing.
 *
 * **Validates: Concept 01; Concept 00 §7; Requirements 3.4, 3.6, 8.4, 16.6**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration, Race, Stat } from '../../types/config';
import { isFormulaError } from '../formula/errors';
import { calculateRaceStatBases, calculateStatTotal, calculateStatValues } from './statCalculator';

/** A stat with the boring fields filled in, so each test says only what it is about */
function stat(overrides: Partial<Stat> & Pick<Stat, 'id' | 'name' | 'abbreviation'>): Stat {
  return {
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...overrides,
  };
}

function character(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Test',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** The `const.apt_value` the confirmed APT derivation reads */
const APT_SOURCE: Pick<Configuration, 'constants'> = {
  constants: [
    {
      id: 'apt-id',
      name: 'apt_value',
      displayName: 'APT value',
      description: '',
      value: 30,
    },
  ],
};

/** A race stat block, named so each blend test reads as the picking it describes */
function race(id: string, statValues: Record<string, number>): Race {
  return { id, name: id, description: '', statValues };
}

/** A ruleset's constants holding only the blend divisor */
function withDivisor(value: number): Configuration['constants'] {
  return [
    {
      id: 'divisor-id',
      name: 'race_blend_divisor',
      displayName: 'Race blend divisor',
      description: '',
      value,
    },
  ];
}

describe('calculateRaceStatBases — the hybrid blend (TICKET-RACE-02)', () => {
  it('should give a single race its own stat block, unchanged', () => {
    // The sheet writes one race as a blend of that race with itself; taking it as identity is the
    // same answer for the seeded divisor and stays right when the User retunes it
    expect(calculateRaceStatBases([race('dwarf', { str: 14, con: 15 })])).toEqual({
      str: 14,
      con: 15,
    });
  });

  it('should give no races nothing at all', () => {
    expect(calculateRaceStatBases([])).toEqual({});
  });

  it('should average two blocks, rounding an odd sum up', () => {
    const bases = calculateRaceStatBases([
      race('a', { str: 10, dex: 9 }),
      race('b', { str: 12, dex: 12 }),
    ]);

    expect(bases).toEqual({ str: 11, dex: 11 }); // (10+12)/2 = 11; (9+12)/2 = 10.5 → 11
  });

  it('should count a stat one block says nothing about as 0 in the average', () => {
    // Picking a race that lacks the stat is exactly how a Player halves it — the absent entry is
    // a real 0 in the blend, not a reason to skip the stat
    expect(calculateRaceStatBases([race('a', { str: 10 }), race('b', {})])).toEqual({ str: 5 });
  });

  it('should round a negative average away from zero, as `roundup` does', () => {
    // The blend is `roundup` on its concept page, and `roundup` here is Excel's — away from zero.
    // A bare Math.ceil would answer -1 where a User formula spelling roundup answers -2.
    expect(calculateRaceStatBases([race('a', { str: -2 }), race('b', { str: -1 })])).toEqual({
      str: -2,
    });
  });

  it('should change nothing when the same race is picked twice', () => {
    const dwarf = race('dwarf', { str: 14, con: 15 });

    expect(calculateRaceStatBases([dwarf, dwarf])).toEqual({ str: 14, con: 15 });
  });

  it('should read the divisor from the ruleset constant', () => {
    const picked = [race('a', { str: 10 }), race('b', { str: 12 })];

    expect(calculateRaceStatBases(picked, withDivisor(1))).toEqual({ str: 22 });
    expect(calculateRaceStatBases(picked, withDivisor(4))).toEqual({ str: 6 }); // 22/4 = 5.5 → 6
  });

  it('should fall back to the seeded divisor when the constant is missing or unusable', () => {
    const picked = [race('a', { str: 10 }), race('b', { str: 12 })];

    // A zero divisor would make every base Infinity, which is a worse answer than the seed
    expect(calculateRaceStatBases(picked, withDivisor(0))).toEqual({ str: 11 });
    expect(calculateRaceStatBases(picked, [])).toEqual({ str: 11 });
  });

  describe('the sheet’s MAX(1, …) floor (TICKET-RACE-03)', () => {
    it('should give a stat both blocks carry at 0 the floor of 1', () => {
      // `Background Setup Calculations ` H33:H41 wraps the halving in `MAX(1, …)`, so a pairing
      // that supplies nothing still supplies 1. This read 0 before the floor.
      expect(calculateRaceStatBases([race('a', { str: 0 }), race('b', { str: 0 })])).toEqual({
        str: 1,
      });
    });

    it('should floor a pairing whose values cancel out', () => {
      // The only other way a blend lands on 0: the divisor is positive, so nothing else can
      expect(calculateRaceStatBases([race('a', { str: 4 }), race('b', { str: -4 })])).toEqual({
        str: 1,
      });
    });

    it('should floor a single race’s explicit zero too, so picking it twice still changes nothing', () => {
      const hollow = race('hollow', { str: 0, con: 15 });

      expect(calculateRaceStatBases([hollow])).toEqual({ str: 1, con: 15 });
      expect(calculateRaceStatBases([hollow, hollow])).toEqual({ str: 1, con: 15 });
    });

    it('should leave a stat neither block mentions out of the blend entirely', () => {
      // A block stores no zeros (TICKET-RACE-01 prunes them), so "both races have it at 0" is
      // normally "neither race names it" — which is absent here and reaches the composition as 0
      const bases = calculateRaceStatBases([race('a', { str: 10 }), race('b', { str: 12 })]);

      expect(bases).toEqual({ str: 11 });
      expect('dex' in bases).toBe(false);
    });

    it('should leave every non-zero blend bit-for-bit what it was', () => {
      // The floor is the one new term; nothing else about the chain moved. Negatives included —
      // the workbook's literal MAX(1, …) would raise them, and the app keeps a ruleset's own
      // negative stat block (see `withBlendFloor`)
      expect(
        calculateRaceStatBases([race('a', { str: 10, dex: 9 }), race('b', { str: 12, dex: 12 })])
      ).toEqual({
        str: 11,
        dex: 11,
      });
      expect(calculateRaceStatBases([race('a', { str: -2 }), race('b', { str: -1 })])).toEqual({
        str: -2,
      });
      expect(calculateRaceStatBases([race('a', { str: 10 }), race('b', {})])).toEqual({ str: 5 });
    });
  });

  it('should ignore a third race rather than distorting the blend', () => {
    // The cardinality is enforced where characters are written; hand-edited data reaching the
    // engine gets the ruleset's own count blended rather than a longer sum divided by it
    const bases = calculateRaceStatBases([
      race('a', { str: 10 }),
      race('b', { str: 12 }),
      race('c', { str: 100 }),
    ]);

    expect(bases).toEqual({ str: 11 });
  });

  describe('the count as ruleset data (TICKET-RACE-04)', () => {
    /** A ruleset's constants, stating a race count and optionally a divisor */
    function withCount(count: number, divisor?: number): Configuration['constants'] {
      const stated = [
        {
          id: 'race-count-id',
          name: 'race_count',
          displayName: 'Races per character',
          description: '',
          value: count,
        },
      ];

      if (divisor === undefined) return stated;

      const dividing = withDivisor(divisor) ?? [];
      return [...stated, ...dividing];
    }

    it('should blend three blocks over three when the ruleset asks for three', () => {
      // The divisor **defaults to the count** (see `raceBlendDivisor`), which is the ticket's
      // decision: roundup((10 + 12 + 5) / 3) = roundup(9) = 9, and the same three picked as
      // themselves stay themselves
      const three = [race('a', { str: 10 }), race('b', { str: 12 }), race('c', { str: 5 })];
      const asksForThree = withCount(3);

      expect(calculateRaceStatBases(three, asksForThree)).toEqual({ str: 9 });
    });

    it('should keep a pure-blood intact at every count', () => {
      // The property the whole model rests on, and the reason the divisor follows the count: the
      // same race in every slot is the race itself, at 1, at 3 and at 4
      const dwarf = race('dwarf', { str: 14, con: 15 });
      const block = { str: 14, con: 15 };

      const alone = calculateRaceStatBases([dwarf], withCount(1));
      const thrice = calculateRaceStatBases([dwarf, dwarf, dwarf], withCount(3));
      const fourfold = calculateRaceStatBases([dwarf, dwarf, dwarf, dwarf], withCount(4));

      expect(alone).toEqual(block);
      expect(thrice).toEqual(block);
      expect(fourfold).toEqual(block);
    });

    it('should blend only as many as the count, whatever it is handed', () => {
      const four = [
        race('a', { str: 10 }),
        race('b', { str: 12 }),
        race('c', { str: 100 }),
        race('d', { str: 100 }),
      ];

      const atOne = calculateRaceStatBases(four, withCount(1));
      const atFour = calculateRaceStatBases(four, withCount(4));

      // A count of 1 takes the first block and nothing else — the lone-block answer
      expect(atOne).toEqual({ str: 10 });
      // …and a count of 4 blends all of them: roundup(222 / 4) = roundup(55.5) = 56
      expect(atFour).toEqual({ str: 56 });
    });

    it('should let an explicit divisor override the count, so a ruleset can sum instead', () => {
      // The divisor stays a dial rather than becoming an alias for the count — a three-race
      // ruleset that wants its parents summed writes 1 and gets 27, not 9
      const three = [race('a', { str: 10 }), race('b', { str: 12 }), race('c', { str: 5 })];
      const summing = withCount(3, 1);

      expect(calculateRaceStatBases(three, summing)).toEqual({ str: 27 });
    });

    it('should read no count at all as the sheet’s two, exactly as before', () => {
      const picked = [race('a', { str: 10 }), race('b', { str: 12 }), race('c', { str: 100 })];

      expect(calculateRaceStatBases(picked, [])).toEqual({ str: 11 });
    });
  });
});

describe('calculateStatValues', () => {
  describe('the three kinds of stat', () => {
    it('should compose an invested stat from the points put into it', () => {
      const stats = [stat({ id: 'str', name: 'Strength', abbreviation: 'STR' })];

      const values = calculateStatValues(stats, character({ investedStatPoints: { str: 7 } }));

      expect(values.str).toBe(7);
    });

    it('should read a resource stat as a maximum, composed the same way', () => {
      // Mana is the case the v1 split could not express: invested *and* tracked
      const stats = [stat({ id: 'mana', name: 'Mana', abbreviation: 'MAN', isResource: true })];

      const values = calculateStatValues(stats, character({ investedStatPoints: { mana: 310 } }));

      expect(values.mana).toBe(310);
    });

    it('should compute a derived stat from its formula and ignore any investment', () => {
      const stats = [
        stat({ id: 'speed', name: 'Speed', abbreviation: 'SPD' }),
        stat({ id: 'double', name: 'Double', abbreviation: 'DBL', formula: 'stats.speed * 2' }),
      ];

      const values = calculateStatValues(
        stats,
        character({ investedStatPoints: { speed: 12, double: 99 } })
      );

      expect(values.speed).toBe(12);
      expect(values.double).toBe(24);
    });
  });

  describe('the confirmed APT derivation (Concept 01)', () => {
    it('should give 1 attack at Speed 30', () => {
      const stats = [
        stat({ id: 'speed', name: 'Speed', abbreviation: 'SPD' }),
        stat({
          id: 'apt',
          name: 'APT',
          abbreviation: 'APT',
          formula: 'max(1, round(stats.speed / const.apt_value))',
        }),
      ];

      const values = calculateStatValues(stats, character({ investedStatPoints: { speed: 30 } }), {
        source: APT_SOURCE,
      });

      expect(values.apt).toBe(1);
    });

    it('should hold at 1 below the threshold, and step up past it', () => {
      const stats = [
        stat({ id: 'speed', name: 'Speed', abbreviation: 'SPD' }),
        stat({
          id: 'apt',
          name: 'APT',
          abbreviation: 'APT',
          formula: 'max(1, round(stats.speed / const.apt_value))',
        }),
      ];

      const at = (speed: number) =>
        calculateStatValues(stats, character({ investedStatPoints: { speed } }), {
          source: APT_SOURCE,
        }).apt;

      expect(at(0)).toBe(1);
      expect(at(44)).toBe(1);
      expect(at(45)).toBe(2);
    });
  });

  describe('clamping and rounding', () => {
    const bounded = (overrides: Partial<Stat>, points: number) =>
      calculateStatValues(
        [stat({ id: 's', name: 'S', abbreviation: 'S', ...overrides })],
        character({ investedStatPoints: { s: points } })
      ).s;

    it('should hold a value at its floor and its ceiling', () => {
      expect(bounded({ min: 3 }, 1)).toBe(3);
      expect(bounded({ min: 3 }, 3)).toBe(3);
      expect(bounded({ max: 10 }, 11)).toBe(10);
      expect(bounded({ max: 10 }, 10)).toBe(10);
    });

    it('should round the way the stat asks, after clamping', () => {
      const half = { formula: '2.5' };
      const round = (rounding: Stat['rounding']) =>
        calculateStatValues(
          [stat({ id: 's', name: 'S', abbreviation: 'S', ...half, rounding })],
          character()
        ).s;

      expect(round('none')).toBe(2.5);
      expect(round('nearest')).toBe(3);
      expect(round('up')).toBe(3);
      expect(round('down')).toBe(2);
    });

    it('should clamp before rounding, so a bound is never rounded past', () => {
      const values = calculateStatValues(
        [stat({ id: 's', name: 'S', abbreviation: 'S', formula: '9.6', max: 9, rounding: 'up' })],
        character()
      );

      expect(values.s).toBe(9);
    });

    it('should not let rounding carry a value past a fractional bound (CR-41)', () => {
      // The clamp lands on the bound itself, and the rounding mode would then move it outside the
      // range the ruleset declared — so it is clamped again afterwards
      const ceiling = calculateStatValues(
        [
          stat({
            id: 's',
            name: 'S',
            abbreviation: 'S',
            formula: '12',
            max: 10.6,
            rounding: 'nearest',
          }),
        ],
        character()
      );
      const floor = calculateStatValues(
        [stat({ id: 's', name: 'S', abbreviation: 'S', formula: '0', min: 2.4, rounding: 'down' })],
        character()
      );

      expect(ceiling.s).toBe(10.6);
      expect(floor.s).toBe(2.4);
    });
  });

  describe('composition terms', () => {
    const races: Race[] = [
      {
        id: 'dwarf',
        name: 'Dwarf',
        description: '',
        statValues: { str: 2 },
      },
    ];

    it('should add a race stat block and equipment bonuses to an invested stat', () => {
      const stats = [stat({ id: 'str', name: 'Strength', abbreviation: 'STR' })];

      const values = calculateStatValues(stats, character({ investedStatPoints: { str: 5 } }), {
        races,
        equipmentBonuses: [{ statId: 'str', modifier: 3 }],
      });

      expect(values.str).toBe(10);
    });

    it('should compose from the blended base when two races are picked (TICKET-RACE-02)', () => {
      const stats = [stat({ id: 'str', name: 'Strength', abbreviation: 'STR' })];

      const values = calculateStatValues(stats, character({ investedStatPoints: { str: 5 } }), {
        races: [race('dwarf', { str: 9 }), race('elf', { str: 12 })],
        equipmentBonuses: [{ statId: 'str', modifier: 3 }],
      });

      expect(values.str).toBe(19); // base 11 (from 9 and 12) + 5 invested + 3 equipment
    });

    it('should read a stat the race block says nothing about as 0 (TICKET-RACE-01)', () => {
      // Adding a stat to the ruleset must not invalidate every existing race: a block that has
      // no entry for it contributes nothing, rather than making the stat unresolvable
      const stats = [
        stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
        stat({ id: 'wis', name: 'Wisdom', abbreviation: 'WIS' }),
      ];

      const values = calculateStatValues(stats, character({ investedStatPoints: { wis: 3 } }), {
        races, // dwarf's block names `str` only
      });

      expect(values.wis).toBe(3);
      expect(values.str).toBe(2);
    });

    it('should ignore a race block entry naming a stat the ruleset no longer defines', () => {
      // The converse (TICKET-REF-02): the ruleset alone decides what exists, so a dangling entry
      // contributes nothing rather than answering for a deleted stat
      const stats = [stat({ id: 'str', name: 'Strength', abbreviation: 'STR' })];

      const values = calculateStatValues(stats, character(), {
        races: [{ id: 'ghost', name: 'Ghost', description: '', statValues: { str: 1, gone: 99 } }],
      });

      expect(values).toEqual({ str: 1 });
    });

    it('should move a derived stat when the stat it reads gains equipment', () => {
      const stats = [
        stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
        stat({ id: 'hp', name: 'Health', abbreviation: 'HP', formula: 'stats.strength * 10' }),
      ];

      const values = calculateStatValues(stats, character({ investedStatPoints: { str: 5 } }), {
        equipmentBonuses: [{ statId: 'str', modifier: 2 }],
      });

      expect(values.hp).toBe(70);
    });

    it('should single no stat out, the focus bonus being gone (TICKET-ARC-03)', () => {
      const stats = [
        stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
        stat({ id: 'dex', name: 'Dexterity', abbreviation: 'DEX' }),
      ];

      const values = calculateStatValues(
        stats,
        character({ investedStatPoints: { str: 1, dex: 1 } })
      );

      // Equal spends, equal values — there is no longer any term that can favour one stat
      expect(values.str).toBe(1);
      expect(values.dex).toBe(1);
    });
  });

  describe('every configured stat has a value (TICKET-CALC-02)', () => {
    it('should read an unallocated stat as 0 rather than leaving it out', () => {
      const stats = [
        stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
        stat({ id: 'wis', name: 'Wisdom', abbreviation: 'WIS' }),
      ];

      const values = calculateStatValues(stats, character({ investedStatPoints: { str: 3 } }));

      expect(values.wis).toBe(0);
    });

    it('should let a formula name a stat nobody has invested in', () => {
      const stats = [
        stat({ id: 'wis', name: 'Wisdom', abbreviation: 'WIS' }),
        stat({ id: 'mp', name: 'Mana', abbreviation: 'MP', formula: 'stats.wisdom * 5' }),
      ];

      const values = calculateStatValues(stats, character());

      expect(values.mp).toBe(0);
    });

    it('should ignore points filed under a stat the ruleset no longer defines', () => {
      const stats = [stat({ id: 'str', name: 'Strength', abbreviation: 'STR' })];

      const values = calculateStatValues(
        stats,
        character({ investedStatPoints: { str: 2, gone: 40 } })
      );

      expect(values).toEqual({ str: 2 });
    });
  });

  describe('formulas that cannot be computed (Concept 00 §7)', () => {
    it('should give the broken stat an error value and calculate the rest', () => {
      const stats = [
        stat({ id: 'ok', name: 'Fine', abbreviation: 'OK', formula: '2 + 2' }),
        stat({ id: 'bad', name: 'Broken', abbreviation: 'BAD', formula: 'stats.nothing + 1' }),
      ];

      const values = calculateStatValues(stats, character());

      expect(values.ok).toBe(4);
      expect(isFormulaError(values.bad)).toBe(true);
    });

    it('should terminate on a cycle, reporting each stat in it rather than hanging', () => {
      const stats = [
        stat({ id: 'a', name: 'A', abbreviation: 'A', formula: 'stats.b + 1' }),
        stat({ id: 'b', name: 'B', abbreviation: 'B', formula: 'stats.a + 1' }),
      ];

      const values = calculateStatValues(stats, character());

      expect(isFormulaError(values.a)).toBe(true);
      expect(isFormulaError(values.b)).toBe(true);
    });

    it('should resolve a chain of derived stats whatever order they are declared in', () => {
      // `third` is declared before what it depends on — resolution is by passes, not by position
      const stats = [
        stat({ id: 'third', name: 'Third', abbreviation: 'C', formula: 'stats.second + 1' }),
        stat({ id: 'second', name: 'Second', abbreviation: 'B', formula: 'stats.first + 1' }),
        stat({ id: 'first', name: 'First', abbreviation: 'A' }),
      ];

      const values = calculateStatValues(stats, character({ investedStatPoints: { first: 10 } }));

      expect(values.second).toBe(11);
      expect(values.third).toBe(12);
    });
  });
});

describe('calculateStatTotal', () => {
  const stats = [
    stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
    stat({ id: 'wis', name: 'Wisdom', abbreviation: 'WIS' }),
    stat({ id: 'apt', name: 'APT', abbreviation: 'APT', countsTowardTotal: false }),
  ];

  it('should sum only the stats flagged as counting', () => {
    const values = calculateStatValues(
      stats,
      character({ investedStatPoints: { str: 6, wis: 4, apt: 100 } })
    );

    expect(calculateStatTotal(stats, values)).toBe(10);
  });

  it('should skip a stat whose value could not be computed rather than poisoning the total', () => {
    const broken = [
      stat({ id: 'str', name: 'Strength', abbreviation: 'STR' }),
      stat({ id: 'bad', name: 'Broken', abbreviation: 'BAD', formula: 'stats.nothing' }),
    ];

    const values = calculateStatValues(broken, character({ investedStatPoints: { str: 6 } }));

    expect(calculateStatTotal(broken, values)).toBe(6);
  });
});
