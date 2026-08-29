/**
 * Import/Export — inlays
 *
 * The gem family and its gapped tier ladder on the wire. Split out of `importExport.test.ts` by
 * TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; v4 systems/10, TICKET-INL-01**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  ValidationError,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — inlays (v4 systems/10, TICKET-INL-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  /**
   * The shape the data pass's Zircon needs: nine rungs and a **gap** where the tenth would be
   *
   * The sheet's Zircon row 10 is blank, and this is what "a gap, not a zero" means in the
   * persisted form — the ladder is the rungs the family *has*, each carrying its own number, so
   * nothing has to invent a tenth row to keep the array dense.
   */
  const zircon = {
    id: 'zircon',
    name: 'Zircon',
    description: '',
    group: 'Common Gems',
    tiers: [
      { tier: 1, bonuses: [{ statId: 'DEX', modifier: 1 }] },
      { tier: 9, bonuses: [{ statId: 'DEX', modifier: 9 }] },
    ],
  };

  const withInlays = (inlays: unknown): Configuration =>
    ({ ...validConfig, inlays }) as Configuration;

  it('should accept a file with no inlays key — absent means none', () => {
    const noInlays: Record<string, unknown> = { ...validConfig };
    delete noInlays.inlays;

    expect(validateConfigurationShape(noInlays).isValid).toBe(true);
    expect('inlays' in noInlays).toBe(false);
  });

  it('should leave a ruleset with no inlays without one after a round-trip', () => {
    const exported = serializeConfiguration(validConfig);
    const imported = importConfiguration(exported);

    expect(imported).not.toHaveProperty('inlays');
  });

  it('should round-trip a gapped ladder with no invented tier', () => {
    const config = withInlays([zircon]);

    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.inlays).toEqual([zircon]);
    expect(imported.inlays?.[0].tiers.map((tier) => tier.tier)).toEqual([1, 9]);
  });

  it('should keep a grant spelled in stat ids on the wire, not in abbreviations', () => {
    // Like a material tier's modifier, a grant is already an id, so it crosses the
    // reference-form boundary untranslated and a rename cannot orphan it
    const config = withInlays([zircon]);

    const exported = serializeConfiguration(config);
    const raw = JSON.parse(exported);

    expect(raw.inlays[0].tiers[0].bonuses).toEqual([{ statId: 'DEX', modifier: 1 }]);
  });

  it('should round-trip a family in no group without growing an empty heading', () => {
    const ungrouped = { ...zircon, group: undefined };

    const config = withInlays([ungrouped]);
    const exported = serializeConfiguration(config);
    const imported = importConfiguration(exported);

    expect(imported.inlays?.[0]).not.toHaveProperty('group');
  });

  it('should reject inlays that is not an array', () => {
    const result = validateConfigurationShape({ ...validConfig, inlays: 'gems' });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('inlays');
  });

  it('should reject a grant that is not { statId, modifier }', () => {
    const badTarget = withInlays([
      { ...zircon, tiers: [{ tier: 1, bonuses: [{ statId: '', modifier: 1 }] }] },
    ]);
    const badNumber = withInlays([
      { ...zircon, tiers: [{ tier: 1, bonuses: [{ statId: 'DEX', modifier: 'a lot' }] }] },
    ]);

    expect(() => importConfiguration(JSON.stringify(badTarget))).toThrow(ValidationError);
    expect(() => importConfiguration(JSON.stringify(badNumber))).toThrow(ValidationError);
  });

  it('should reject a rung that is not a whole number from 1 up', () => {
    const result = validateConfigurationShape(
      withInlays([{ ...zircon, tiers: [{ tier: 0, bonuses: [] }] }])
    );

    expect(result.errors).toContain('inlays[0].tiers[0].tier must be a whole number from 1 up');
  });

  it('should reject two rows claiming the same rung', () => {
    // Which tier a socket names has to have one answer, or a composed item is priced by whichever
    // row happens to come first
    const result = validateConfigurationShape(
      withInlays([
        {
          ...zircon,
          tiers: [
            { tier: 3, bonuses: [] },
            { tier: 3, bonuses: [] },
          ],
        },
      ])
    );

    expect(result.errors).toContain('inlays[0].tiers[1].tier 3 is claimed by more than one row');
  });
});
