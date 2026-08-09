/**
 * Stats Namespace Tests
 *
 * The load-bearing distinction here is between the resolver's three answers: `undefined` for a
 * member that is not a stat, a `not-evaluable` error for a stat with no value **yet**, and the
 * value itself. The composition in `calculators/statCalculator.ts` uses the middle one to decide
 * whether another pass is worth running, so collapsing it into either neighbour would either hang
 * the resolution or report a cycle that isn't there.
 *
 * **Validates: Concept 01; Concept 00 §5, §7**
 */

import { describe, expect, it } from 'vitest';
import type { Stat } from '../../types/config';
import { isFormulaError } from './errors';
import { statsNamespace } from './stats';

function stat(id: string, name: string, abbreviation: string): Stat {
  return {
    id,
    name,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
  };
}

const STATS = [stat('id-str', 'Strength', 'STR'), stat('id-hp', 'Max Health', 'HP')];

describe('statsNamespace', () => {
  it('resolves a stat by its name slug, not by its abbreviation', () => {
    const resolver = statsNamespace(STATS, { 'id-str': 7 });

    expect(resolver.resolve('strength')).toBe(7);
    // `STR` is the flat space's spelling; the dotted one is the slug
    expect(resolver.resolve('STR')).toBeUndefined();
  });

  it('slugs a multi-word name the way references.ts does', () => {
    const resolver = statsNamespace(STATS, { 'id-hp': 42 });

    expect(resolver.resolve('max_health')).toBe(42);
  });

  it('reports an unknown member as undefined, so the evaluator can name it', () => {
    const resolver = statsNamespace(STATS, {});

    expect(resolver.resolve('nothing')).toBeUndefined();
  });

  it('reports a stat with no value yet as an error, not as absent', () => {
    // Absent would read as `Unknown member` and stop the composition retrying it
    const resolver = statsNamespace(STATS, {});
    const result = resolver.resolve('strength');

    expect(result).toBeDefined();
    expect(isFormulaError(result)).toBe(true);
  });

  it('carries an upstream error value through rather than hiding it', () => {
    const broken = { formulaError: true, kind: 'not-evaluable', message: 'nope' } as const;
    const resolver = statsNamespace(STATS, { 'id-str': broken });

    expect(resolver.resolve('strength')).toBe(broken);
  });

  it('refuses a property on a stat — a stat is a single value', () => {
    const resolver = statsNamespace(STATS, { 'id-str': 7 });
    const result = resolver.resolve('strength', 'level');

    expect(isFormulaError(result)).toBe(true);
  });

  it('gives an ambiguous slug to the first claimant only', () => {
    // Two stats slugging the same way should not exist, but an import can produce them; both
    // halves of the app must at least agree which one answers (matching `references.ts`)
    const resolver = statsNamespace(
      [stat('id-a', 'Health', 'HEA'), stat('id-b', 'health', 'HLT')],
      { 'id-a': 1, 'id-b': 2 }
    );

    expect(resolver.resolve('health')).toBe(1);
  });

  it('is not callable — a stat is read, never invoked', () => {
    expect(statsNamespace(STATS, {}).call).toBeUndefined();
  });
});
