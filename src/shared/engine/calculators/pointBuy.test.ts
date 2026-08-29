/**
 * Point Buy Tests
 *
 * Concept 03's confirmed rates are the thing worth pinning: against Concept 06's seed table, 15
 * points buy 5 / 7 / 12 by affinity — the 2.4× spread the sheet shows. TICKET-DX-04 re-pins the
 * same numbers against the imported corpus.
 *
 * **TICKET-ARC-04 adds the dream term**, so every rate above is now stated *at a dream level*: the
 * table's own numbers are what the neutral level of 1 buys on a `non` stat, `main` multiplies and
 * `sub` adds. The fixture below is the ticket's own — a dream level is passed explicitly at every
 * call rather than defaulted, because there is no default here to test (RES-04's reader owns it).
 *
 * **Validates: Concept 03; Concept 06; Requirements 16.6; v4 systems/05**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Archetype, Configuration, Curve, StatAffinity } from '../../types/config';
import { STAT_AFFINITIES, STAT_AFFINITY } from '../../types/config';
import { DEFAULT_DREAM_LEVEL, dreamLevelOf } from '../dreamLevel';
import { isFormulaError } from '../formula/errors';
import { affinityFor, archetypeOf, pointBuyCurve, statGain } from './pointBuy';

/**
 * The seeded `point_buy` table, as `createSeedCurves` builds it
 *
 * **A copy of `POINT_BUY_HAND_ROWS`, and knowingly so**: the store's seed cannot be imported here
 * without dragging the whole store in, and the numbers are Concept 06's rather than either file's.
 * The consequence is real — retuning the seed desyncs this fixture silently — and it is TICKET-DX-04
 * that closes it by re-pinning the same rates against the imported corpus. Only the `main` column
 * is derived rather than copied, from the generator the seed actually ships.
 */
function seedPointBuy(overrides: Partial<Curve> = {}): Curve {
  const hand: readonly (readonly [number, number, number])[] = [
    [0, 0, 0],
    [1, 1, 1],
    [2, 1, 1],
    [3, 1, 2],
    [4, 2, 2],
    [5, 2, 3],
    [6, 2, 3],
    [7, 3, 4],
    [8, 3, 4],
    [9, 3, 4.642857142857],
    [10, 4, 5],
    [11, 4, 5],
    [12, 4, 6],
    [13, 4, 6],
    [14, 5, 7],
    [15, 5, 7],
  ];

  return {
    id: 'curve-point-buy',
    name: 'point_buy',
    displayName: 'Point buy',
    description: '',
    keyName: 'points',
    columns: [
      { id: 'col-non', name: 'non' },
      { id: 'col-sub', name: 'sub' },
      { id: 'col-main', name: 'main', generator: '0.75 * (key + 1)' },
    ],
    rows: hand.map(([key, non, sub]) => ({ key, values: [non, sub, 0.75 * (key + 1)] })),
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
    ...overrides,
  };
}

const STRONG: Archetype = {
  id: 'strong',
  name: 'Strong',
  description: '',
  statAffinity: { 'str-id': 'main', 'dex-id': 'sub' },
};

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    curves: [seedPointBuy()],
    archetypes: [STRONG],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
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

/** What 15 points buy at each affinity, at the neutral dream level */
const confirmedRates: readonly [StatAffinity, number][] = [
  [STAT_AFFINITY.NON, 5],
  [STAT_AFFINITY.SUB, 8],
  [STAT_AFFINITY.MAIN, 12],
];

describe('statGain', () => {
  describe("Concept 03's confirmed rates, at the neutral dream level", () => {
    it.each(confirmedRates)('should buy %s at 15 points for %i', (affinity, expected) => {
      // The 2.4x spread the sheet confirms, and why the sample Funny character reaches Char 39.
      // `sub` reads 8 rather than the table's 7 because dream 1 is added flat (TICKET-ARC-04).
      const curve = seedPointBuy();

      expect(statGain(15, affinity, curve, DEFAULT_DREAM_LEVEL)).toBe(expected);
    });

    it('should read the whole main column off its generator, times the dream level', () => {
      // 0.75 x (points + 1) exactly — the property that makes flattening the advantage one edit
      const curve = seedPointBuy();

      for (const points of [1, 4, 8, 12, 15]) {
        const generated = 0.75 * (points + 1);

        expect(statGain(points, STAT_AFFINITY.MAIN, curve, 1)).toBeCloseTo(generated, 10);
        expect(statGain(points, STAT_AFFINITY.MAIN, curve, 4)).toBeCloseTo(generated * 4, 10);
      }
    });

    it('should give a main-type stat more than a sub-type, and sub more than non', () => {
      const curve = seedPointBuy();
      const main = statGain(10, STAT_AFFINITY.MAIN, curve, DEFAULT_DREAM_LEVEL) as number;
      const sub = statGain(10, STAT_AFFINITY.SUB, curve, DEFAULT_DREAM_LEVEL) as number;
      const non = statGain(10, STAT_AFFINITY.NON, curve, DEFAULT_DREAM_LEVEL) as number;

      expect(main).toBeGreaterThan(sub);
      expect(sub).toBeGreaterThan(non);
    });

    it('should let the flat sub term out-buy the multiplied main one at the bottom of the table', () => {
      // Not a bug and not a rounding artefact — the sheet's two formulas simply meet differently
      // at a low spend: main is 0.75 x (1 + 1) x 1 while sub is the table's 1 plus a whole dream
      // level. Pinned so that "sub beat main" is read as the formulas rather than as a regression;
      // raising the dream tilts it back, which the second pair is.
      const curve = seedPointBuy();
      const subAtOne = statGain(1, STAT_AFFINITY.SUB, curve, 1) as number;
      const mainAtOne = statGain(1, STAT_AFFINITY.MAIN, curve, 1) as number;
      const subDreaming = statGain(1, STAT_AFFINITY.SUB, curve, 4) as number;
      const mainDreaming = statGain(1, STAT_AFFINITY.MAIN, curve, 4) as number;

      expect(subAtOne).toBeGreaterThan(mainAtOne);
      expect(mainDreaming).toBeGreaterThan(subDreaming);
    });
  });

  describe('invariants (fast-check)', () => {
    it('should never grant anything for a negative spend, whatever the dream level', () => {
      const curve = seedPointBuy();

      fc.assert(
        fc.property(
          fc.integer({ min: -50, max: -1 }),
          fc.constantFrom(STAT_AFFINITY.MAIN, STAT_AFFINITY.SUB, STAT_AFFINITY.NON),
          fc.integer({ min: 1, max: 20 }),
          (points, affinity, dream) => statGain(points, affinity, curve, dream) === 0
        )
      );
    });

    it('should never make a favoured stat worth less than an ignored one', () => {
      // `main >= sub` is *not* an invariant any more — see the crossover pinned above — but neither
      // favoured column ever falls below `non`, which is what "the archetype favours it" means
      const curve = seedPointBuy();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }),
          fc.integer({ min: 1, max: 20 }),
          (points, dream) => {
            const main = statGain(points, STAT_AFFINITY.MAIN, curve, dream) as number;
            const sub = statGain(points, STAT_AFFINITY.SUB, curve, dream) as number;
            const non = statGain(points, STAT_AFFINITY.NON, curve, dream) as number;
            return main >= non && sub >= non;
          }
        )
      );
    });

    it('should leave a non-type stat untouched by the dream level', () => {
      const curve = seedPointBuy();

      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 15 }),
          fc.integer({ min: 1, max: 20 }),
          (points, dream) => {
            const dreaming = statGain(points, STAT_AFFINITY.NON, curve, dream);
            const neutral = statGain(points, STAT_AFFINITY.NON, curve, DEFAULT_DREAM_LEVEL);
            return dreaming === neutral;
          }
        )
      );
    });

    it('should be the identity for any spend when there is no curve', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 500 }), (points) => {
          return statGain(points, STAT_AFFINITY.MAIN, undefined, DEFAULT_DREAM_LEVEL) === points;
        })
      );
    });
  });

  describe('the dream term (TICKET-ARC-04)', () => {
    it.each([1, 2, 5, 12])(
      'should grant a sub-type stat +%i at zero points, on the dream level alone',
      (dream) => {
        // The User's 2026-08-29 ruling, as the sheet's formulas have it: an archetype grants a
        // small passive block over its two sub stats, and it grows with the dream
        const curve = seedPointBuy();

        expect(statGain(0, STAT_AFFINITY.SUB, curve, dream)).toBe(dream);
      }
    );

    it('should move a stat when the dream is raised and nothing else is written', () => {
      const curve = seedPointBuy();
      const before = statGain(4, STAT_AFFINITY.SUB, curve, 1) as number;
      const after = statGain(4, STAT_AFFINITY.SUB, curve, 3) as number;

      // Same spend, same curve, same affinity — only the dream moved
      expect(after - before).toBe(2);
    });

    it('should make main(0) a real fractional 0.75 x the dream level', () => {
      // ARC-02 zeroed this on the reading that the generator was fitted over the range a Player
      // spends in. TICKET-ARC-04 supersedes that note: the sheet reads the 0 row like any other
      const curve = seedPointBuy();
      const neutral = statGain(0, STAT_AFFINITY.MAIN, curve, 1);
      const dreaming = statGain(0, STAT_AFFINITY.MAIN, curve, 4);

      expect(neutral).toBeCloseTo(0.75, 10);
      expect(dreaming).toBeCloseTo(3, 10);
      expect(Number.isInteger(neutral)).toBe(false);
    });

    it('should amplify the 1:1 fallback too, since the term is the formula and not the table', () => {
      expect(statGain(7, STAT_AFFINITY.MAIN, undefined, 3)).toBe(21);
      expect(statGain(7, STAT_AFFINITY.SUB, undefined, 3)).toBe(10);
      expect(statGain(7, STAT_AFFINITY.NON, undefined, 3)).toBe(7);
    });

    it('should compute a character with no dream level exactly as one at level 1', () => {
      // RES-04's reader owns the absent-means-1 default, and this calculator adds no second one
      const untouched = dreamLevelOf(createCharacter());
      const curve = seedPointBuy();

      for (const affinity of STAT_AFFINITIES) {
        const read = statGain(6, affinity, curve, untouched);
        const neutral = statGain(6, affinity, curve, DEFAULT_DREAM_LEVEL);

        expect(read).toBe(neutral);
      }
      expect(untouched).toBe(DEFAULT_DREAM_LEVEL);
    });
  });

  describe('spending nothing', () => {
    it('should still gain nothing on a non-type stat, which the dream does not reach', () => {
      const curve = seedPointBuy();

      expect(statGain(0, STAT_AFFINITY.NON, curve, 5)).toBe(0);
    });

    it('should gain nothing at zero points with no curve and no favour', () => {
      expect(statGain(0, STAT_AFFINITY.NON, undefined, DEFAULT_DREAM_LEVEL)).toBe(0);
    });

    it('should gain nothing for a negative allocation rather than reporting out-of-range', () => {
      // The `negative-points` violation is the message; an error chip here would sit where that
      // belongs (found by the conventions-reviewer on this ticket)
      const curve = seedPointBuy();

      expect(statGain(-3, STAT_AFFINITY.MAIN, curve, DEFAULT_DREAM_LEVEL)).toBe(0);
    });
  });

  describe('a ruleset with no point_buy curve', () => {
    it.each([1, 7, 40])('should fall back to 1:1 at %i points', (points) => {
      // The pre-ARC-02 behaviour, so a ruleset written before this ticket keeps working. A ruleset
      // that has archetypes *and* no curve is reported by validateConfiguration instead.
      expect(statGain(points, STAT_AFFINITY.MAIN, undefined, DEFAULT_DREAM_LEVEL)).toBe(points);
    });
  });

  describe('a spend the table cannot price', () => {
    /** The seed with its `main` column removed, rows and all */
    const withoutMainColumn = () =>
      seedPointBuy({
        columns: [
          { id: 'col-non', name: 'non' },
          { id: 'col-sub', name: 'sub' },
        ],
        rows: [
          { key: 0, values: [0, 0] },
          { key: 15, values: [5, 7] },
        ],
      });

    it('should return an error rather than a number past the last row', () => {
      // Entirely reachable: the seed stops at 15 points and refuses out-of-range
      const curve = seedPointBuy();
      const gain = statGain(20, STAT_AFFINITY.MAIN, curve, DEFAULT_DREAM_LEVEL);

      expect(isFormulaError(gain)).toBe(true);
    });

    it('should not fall back to 1:1, which would out-buy the main column', () => {
      // 20 points 1:1 would be 20 — more than the main column ever grants at any key
      const curve = seedPointBuy();

      expect(statGain(20, STAT_AFFINITY.MAIN, curve, DEFAULT_DREAM_LEVEL)).not.toBe(20);
    });

    it('should stay an error rather than being amplified by the dream level', () => {
      // Multiplying a chip by a dream level is not a number either
      const curve = seedPointBuy();
      const gain = statGain(20, STAT_AFFINITY.SUB, curve, 7);

      expect(isFormulaError(gain)).toBe(true);
    });

    it('should return an error when the affinity names no column', () => {
      const noMain = withoutMainColumn();
      const gain = statGain(15, STAT_AFFINITY.MAIN, noMain, DEFAULT_DREAM_LEVEL);

      expect(isFormulaError(gain)).toBe(true);
    });

    it('should still answer for the affinities whose columns are there', () => {
      const noMain = withoutMainColumn();

      expect(statGain(15, STAT_AFFINITY.SUB, noMain, DEFAULT_DREAM_LEVEL)).toBe(8);
    });
  });
});

describe('affinityFor', () => {
  it('should read the tag an archetype gives a stat', () => {
    expect(affinityFor(STRONG, 'str-id')).toBe('main');
    expect(affinityFor(STRONG, 'dex-id')).toBe('sub');
  });

  it('should default an untagged stat to non', () => {
    expect(affinityFor(STRONG, 'wis-id')).toBe('non');
  });

  it('should route every stat through non when the character has no archetype', () => {
    // Defined behaviour rather than an accident: a character mid-creation has not chosen one, and
    // a ruleset may define none at all
    expect(affinityFor(undefined, 'str-id')).toBe('non');
  });
});

describe('archetypeOf', () => {
  it('should resolve the archetype a character was built on', () => {
    const character = createCharacter({ archetypeId: 'strong' });

    expect(archetypeOf(character, createConfig())?.name).toBe('Strong');
  });

  it('should be undefined for a character who has chosen none', () => {
    expect(archetypeOf(createCharacter(), createConfig())).toBeUndefined();
  });

  it('should be undefined for an archetype the ruleset no longer defines', () => {
    const character = createCharacter({ archetypeId: 'deleted' });

    expect(archetypeOf(character, createConfig())).toBeUndefined();
  });
});

describe('pointBuyCurve', () => {
  it('should find the curve by its Concept 06 name', () => {
    expect(pointBuyCurve(createConfig())?.name).toBe('point_buy');
  });

  it('should be undefined for a ruleset that defines no curves', () => {
    expect(pointBuyCurve(createConfig({ curves: undefined }))).toBeUndefined();
  });
});
