/**
 * What a brand-new ruleset arrives holding (TICKET-RUL-01)
 *
 * The function had two lines of coverage while it was private to `configStore` — "stats is empty",
 * "skills is empty" — which said nothing about the half that matters. It now has **two callers**,
 * `useConfigStore.initializeConfig` and `POST /api/rulesets`, and v3 Req 33.3 rests on both getting
 * the same ruleset, so what it seeds is worth stating here rather than in either caller's suite.
 *
 * **Validates: Requirements 1.1; v3 Req 33.3**
 */

import { describe, expect, it } from 'vitest';
import { POINT_BUY_CURVE_NAME, SUPPORTED_SCHEMA_VERSION } from '../types/config';
import { createFreshConfiguration } from './freshConfiguration';

describe('createFreshConfiguration', () => {
  it('is not empty — it arrives with the seed constants', () => {
    const config = createFreshConfiguration('Ducklets');

    expect(config.constants?.map((constant) => constant.name)).toEqual([
      'bonus_divider',
      'apt_value',
      'points_per_level',
      'race_blend_divisor',
    ]);
  });

  it('seeds the point-buy curve with its generated column already filled', () => {
    // The `main` column ships as a generator (`0.75 * (key + 1)`) run through the formula engine
    // rather than as sixteen literals, so retuning it is a one-field edit. A table whose generated
    // column is still zeros is the regression this catches.
    const curve = createFreshConfiguration('Ducklets').curves?.find(
      (candidate) => candidate.name === POINT_BUY_CURVE_NAME
    );

    expect(curve?.columns.map((column) => column.name)).toEqual(['non', 'sub', 'main']);
    expect(curve?.rows.at(-1)?.values).toEqual([5, 7, 12]);
  });

  it('seeds xp_thresholds as a shape rather than as invented numbers', () => {
    // Concept 06's open question #8 — the most campaign-defining lever in the ruleset — so it waits
    // for the User rather than shipping a made-up progression
    const curve = createFreshConfiguration('Ducklets').curves?.find(
      (candidate) => candidate.name === 'xp_thresholds'
    );

    expect(curve?.rows).toEqual([{ key: 1, values: [0] }]);
    expect(curve?.lookupDirection).toBe('reverse');
  });

  it('seeds one ladder and four rolls that point at it', () => {
    const config = createFreshConfiguration('Ducklets');
    const ladder = config.diceLadders?.[0];

    expect(ladder?.dieSizes).toEqual([20, 12, 6]);
    expect(config.rollDefinitions?.map((roll) => roll.name)).toEqual([
      'Melee',
      'Ranged',
      'Evasion',
      'Endure',
    ]);
    // Every roll down the one ladder: minted as a pair precisely so this cannot drift
    expect(config.rollDefinitions?.every((roll) => roll.ladderId === ladder?.id)).toBe(true);
  });

  it('gives every roll an input that computes, so a new ruleset opens with no errors', () => {
    // `stats.str` and friends would name members a fresh ruleset has none of, and four errors on a
    // brand-new configuration is a worse first impression than four placeholders
    expect(createFreshConfiguration('Ducklets').rollDefinitions?.map((roll) => roll.input)).toEqual(
      ['0', '0', '0', '0']
    );
  });

  it('is at the schema version this build reads', () => {
    expect(createFreshConfiguration('Ducklets').schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
  });

  it('shares no identity between two calls', () => {
    // Two rulesets made the same way are two rulesets. The server relies on this: `POST
    // /api/rulesets` uses the document's own id as the row's, so a repeated id would be a
    // primary-key collision rather than a cosmetic clash.
    const first = createFreshConfiguration('Ducklets');
    const second = createFreshConfiguration('Ducklets');

    expect(second.id).not.toBe(first.id);
    expect(second.constants?.[0].id).not.toBe(first.constants?.[0].id);
    expect(second.diceLadders?.[0].id).not.toBe(first.diceLadders?.[0].id);
  });
});
