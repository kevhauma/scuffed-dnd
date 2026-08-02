/**
 * Currency Engine Tests
 *
 * **Validates: Requirements 10.4, 10.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { CurrencyTier } from '../types/config';
import { convertCurrency, formatCurrency, normalizeCurrency } from './currency';

/** 100 copper = 1 silver, 10 silver = 1 gold */
const tiers: CurrencyTier[] = [
  { id: 'copper', name: 'Copper', order: 0, conversionToNext: 100 },
  { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
  { id: 'gold', name: 'Gold', order: 2, conversionToNext: 1 },
];

describe('convertCurrency', () => {
  it('should return the same value when the tier does not change', () => {
    expect(convertCurrency({ tierId: 'silver', amount: 7 }, 'silver', tiers)).toEqual({
      tierId: 'silver',
      amount: 7,
    });
  });

  it('should convert one step up', () => {
    expect(convertCurrency({ tierId: 'copper', amount: 250 }, 'silver', tiers)).toEqual({
      tierId: 'silver',
      amount: 2.5,
    });
  });

  it('should convert one step down', () => {
    expect(convertCurrency({ tierId: 'silver', amount: 3 }, 'copper', tiers)).toEqual({
      tierId: 'copper',
      amount: 300,
    });
  });

  it('should convert across several tiers', () => {
    // 100 copper to the silver, 10 silver to the gold → 1000 copper is 1 gold
    expect(convertCurrency({ tierId: 'copper', amount: 1000 }, 'gold', tiers).amount).toBeCloseTo(1);
    expect(convertCurrency({ tierId: 'gold', amount: 2 }, 'copper', tiers).amount).toBeCloseTo(2000);
  });

  it('should sort by order rather than trusting the array order', () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];

    expect(convertCurrency({ tierId: 'copper', amount: 1000 }, 'gold', shuffled).amount).toBeCloseTo(
      1
    );
  });

  it('should leave the value alone when a tier is unknown', () => {
    expect(convertCurrency({ tierId: 'copper', amount: 5 }, 'platinum', tiers)).toEqual({
      tierId: 'copper',
      amount: 5,
    });
    expect(convertCurrency({ tierId: 'shells', amount: 5 }, 'gold', tiers)).toEqual({
      tierId: 'shells',
      amount: 5,
    });
  });

  it('should stay finite when a conversion rate is zero or negative', () => {
    const broken: CurrencyTier[] = [
      { id: 'copper', name: 'Copper', order: 0, conversionToNext: 0 },
      { id: 'silver', name: 'Silver', order: 1, conversionToNext: -5 },
      { id: 'gold', name: 'Gold', order: 2, conversionToNext: 1 },
    ];

    const up = convertCurrency({ tierId: 'copper', amount: 100 }, 'gold', broken);
    const down = convertCurrency({ tierId: 'gold', amount: 1 }, 'copper', broken);

    for (const result of [up, down]) {
      expect(Number.isFinite(result.amount)).toBe(true);
      expect(Number.isNaN(result.amount)).toBe(false);
    }
  });

  it('should round-trip through any other tier', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        fc.constantFrom('copper', 'silver', 'gold'),
        fc.constantFrom('copper', 'silver', 'gold'),
        (amount: number, from: string, to: string) => {
          const there = convertCurrency({ tierId: from, amount }, to, tiers);
          const back = convertCurrency(there, from, tiers);

          // Floating point, so a tolerance rather than exact equality
          expect(back.amount).toBeCloseTo(amount, 6);
        }
      )
    );
  });
});

describe('normalizeCurrency', () => {
  it('should lift a value to the highest tier where it is still at least one', () => {
    // Requirement 10.4 — 1400 copper reads as 1.4 gold
    expect(normalizeCurrency({ tierId: 'copper', amount: 1400 }, tiers)).toEqual({
      tierId: 'gold',
      amount: 1.4,
    });
  });

  it('should leave a value already in its natural tier alone', () => {
    expect(normalizeCurrency({ tierId: 'silver', amount: 5 }, tiers)).toEqual({
      tierId: 'silver',
      amount: 5,
    });
  });

  it('should keep a value too small for any higher tier in the lowest tier', () => {
    expect(normalizeCurrency({ tierId: 'copper', amount: 0.5 }, tiers)).toEqual({
      tierId: 'copper',
      amount: 0.5,
    });
  });

  it('should stop at the highest tier that still reads as one or more', () => {
    // 50 copper is half a silver, so copper is where it belongs
    expect(normalizeCurrency({ tierId: 'copper', amount: 50 }, tiers).tierId).toBe('copper');
    // 150 copper is 1.5 silver but only 0.15 gold
    expect(normalizeCurrency({ tierId: 'copper', amount: 150 }, tiers).tierId).toBe('silver');
  });

  it('should leave the value alone with no tiers configured or an unknown tier', () => {
    expect(normalizeCurrency({ tierId: 'copper', amount: 5 }, [])).toEqual({
      tierId: 'copper',
      amount: 5,
    });
    expect(normalizeCurrency({ tierId: 'shells', amount: 5 }, tiers)).toEqual({
      tierId: 'shells',
      amount: 5,
    });
  });

  it('should preserve worth, whatever tier it lands in', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1_000_000, noNaN: true }), (amount: number) => {
        const normalized = normalizeCurrency({ tierId: 'copper', amount }, tiers);
        const backToCopper = convertCurrency(normalized, 'copper', tiers);

        expect(backToCopper.amount).toBeCloseTo(amount, 6);
      })
    );
  });
});

describe('formatCurrency', () => {
  it('should name the tier and drop trailing zeros', () => {
    expect(formatCurrency({ tierId: 'gold', amount: 5 }, tiers)).toBe('5 Gold');
    expect(formatCurrency({ tierId: 'gold', amount: 1.4 }, tiers)).toBe('1.4 Gold');
  });

  it('should round to two decimals for display', () => {
    expect(formatCurrency({ tierId: 'gold', amount: 1.23456 }, tiers)).toBe('1.23 Gold');
  });

  it('should fall back to the bare amount for an unknown tier', () => {
    expect(formatCurrency({ tierId: 'shells', amount: 3 }, tiers)).toBe('3');
  });
});
