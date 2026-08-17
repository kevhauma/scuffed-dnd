/**
 * Point Buy Tests
 *
 * Concept 03's confirmed rates are the thing worth pinning: against Concept 06's seed table, 15
 * points buy 5 / 7 / 12 by affinity — the 2.4× spread the sheet shows. TICKET-DX-04 re-pins the
 * same numbers against the imported corpus.
 *
 * **Validates: Concept 03; Concept 06; Requirements 16.6**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Archetype, Configuration, Curve } from '../../types/config';
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
    schemaVersion: 8,
    stats: [],
    skills: [],
    combatSkills: [],
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

describe('statGain', () => {
  describe("Concept 03's confirmed rates", () => {
    it.each([
      ['non' as const, 5],
      ['sub' as const, 7],
      ['main' as const, 12],
    ])('should buy %s at 15 points for %i', (affinity, expected) => {
      // The 2.4x spread the sheet confirms, and why the sample Funny character reaches Char 39
      expect(statGain(15, affinity, seedPointBuy())).toBe(expected);
    });

    it('should read the whole main column off its generator', () => {
      // 0.75 x (points + 1) exactly — the property that makes flattening the advantage one edit
      for (const points of [1, 4, 8, 12, 15]) {
        expect(statGain(points, 'main', seedPointBuy())).toBeCloseTo(0.75 * (points + 1), 10);
      }
    });

    it('should give a main-type stat more than a sub-type, and sub more than non', () => {
      const curve = seedPointBuy();

      expect(statGain(10, 'main', curve)).toBeGreaterThan(statGain(10, 'sub', curve) as number);
      expect(statGain(10, 'sub', curve)).toBeGreaterThan(statGain(10, 'non', curve) as number);
    });
  });

  describe('invariants (fast-check)', () => {
    it('should never grant anything for a non-positive spend', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -50, max: 0 }),
          fc.constantFrom('main' as const, 'sub' as const, 'non' as const),
          (points, affinity) => statGain(points, affinity, seedPointBuy()) === 0
        )
      );
    });

    it('should order main ≥ sub ≥ non at every key the table covers', () => {
      const curve = seedPointBuy();

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 15 }), (points) => {
          const main = statGain(points, 'main', curve) as number;
          const sub = statGain(points, 'sub', curve) as number;
          const non = statGain(points, 'non', curve) as number;
          return main >= sub && sub >= non;
        })
      );
    });

    it('should be the identity for any spend when there is no curve', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 500 }), (points) => {
          return statGain(points, 'main', undefined) === points;
        })
      );
    });
  });

  describe('spending nothing', () => {
    it.each(['main' as const, 'sub' as const, 'non' as const])(
      'should gain nothing at zero points, whatever the affinity (%s)',
      (affinity) => {
        // The seed's main column reads 0.75 at zero, because the generator is fitted over the
        // range a Player spends in — an untouched stat does not drift upward
        expect(statGain(0, affinity, seedPointBuy())).toBe(0);
      }
    );

    it('should gain nothing at zero points even with no curve at all', () => {
      expect(statGain(0, 'main', undefined)).toBe(0);
    });

    it('should gain nothing for a negative allocation rather than reporting out-of-range', () => {
      // The `negative-points` violation is the message; an error chip here would sit where that
      // belongs (found by the conventions-reviewer on this ticket)
      expect(statGain(-3, 'main', seedPointBuy())).toBe(0);
    });
  });

  describe('a ruleset with no point_buy curve', () => {
    it.each([1, 7, 40])('should fall back to 1:1 at %i points', (points) => {
      // The pre-ARC-02 behaviour, so a ruleset written before this ticket keeps working. A ruleset
      // that has archetypes *and* no curve is reported by validateConfiguration instead.
      expect(statGain(points, 'main', undefined)).toBe(points);
    });
  });

  describe('a spend the table cannot price', () => {
    it('should return an error rather than a number past the last row', () => {
      // Entirely reachable: the seed stops at 15 points and refuses out-of-range
      const gain = statGain(20, 'main', seedPointBuy());

      expect(isFormulaError(gain)).toBe(true);
    });

    it('should not fall back to 1:1, which would out-buy the main column', () => {
      // 20 points 1:1 would be 20 — more than the main column ever grants at any key
      expect(statGain(20, 'main', seedPointBuy())).not.toBe(20);
    });

    it('should return an error when the affinity names no column', () => {
      const noMain = seedPointBuy({
        columns: [
          { id: 'col-non', name: 'non' },
          { id: 'col-sub', name: 'sub' },
        ],
        rows: [
          { key: 0, values: [0, 0] },
          { key: 15, values: [5, 7] },
        ],
      });

      expect(isFormulaError(statGain(15, 'main', noMain))).toBe(true);
    });

    it('should still answer for the affinities whose columns are there', () => {
      const noMain = seedPointBuy({
        columns: [
          { id: 'col-non', name: 'non' },
          { id: 'col-sub', name: 'sub' },
        ],
        rows: [
          { key: 0, values: [0, 0] },
          { key: 15, values: [5, 7] },
        ],
      });

      expect(statGain(15, 'sub', noMain)).toBe(7);
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
