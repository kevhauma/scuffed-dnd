/**
 * Import/Export — roll definitions
 *
 * Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-ROLL-05**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — roll definitions (TICKET-ROLL-05)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  const melee = {
    id: 'roll-melee',
    name: 'Melee',
    description: '',
    input: 'STR',
    ladderId: 'ladder-standard',
    category: 'offence' as const,
    order: 0,
  };

  it('should accept a file with no rollDefinitions key — absent means none', () => {
    // `validConfig` carries rolls now, so the absent case is stated by taking them away — the
    // keys have to be *deleted*, since a present key holding `undefined` is not absence
    const noRolls: Record<string, unknown> = { ...validConfig };
    delete noRolls.rollDefinitions;
    delete noRolls.diceLadders;

    expect(validateConfigurationShape(noRolls).isValid).toBe(true);
    expect('rollDefinitions' in noRolls).toBe(false);
  });

  it('should round-trip a roll unchanged', async () => {
    const withRoll: Configuration = { ...validConfig, rollDefinitions: [melee] };

    const imported = importConfiguration(serializeConfiguration(withRoll));

    expect(imported.rollDefinitions).toEqual([melee]);
  });

  it('should round-trip a roll with no category', async () => {
    const uncategorised = { ...melee, category: undefined };
    const withRoll: Configuration = { ...validConfig, rollDefinitions: [uncategorised] };

    const imported = importConfiguration(serializeConfiguration(withRoll));

    expect(imported.rollDefinitions?.[0]).not.toHaveProperty('category');
  });

  it('should reject rollDefinitions that is not an array', () => {
    const result = validateConfigurationShape({ ...validConfig, rollDefinitions: 'four' });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('rollDefinitions');
  });

  it('should reject a roll with no ladder to decompose down', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      rollDefinitions: [{ ...melee, ladderId: undefined }],
    });

    expect(result.errors).toContain('rollDefinitions[0].ladderId must be a dice ladder id');
  });

  it('should reject a roll whose input is not a formula string', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      rollDefinitions: [{ ...melee, input: 12 }],
    });

    expect(result.errors).toContain('rollDefinitions[0].input must be a formula string');
  });

  it('should reject a category this build does not have', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      rollDefinitions: [{ ...melee, category: 'sneaky' }],
    });

    expect(result.errors.join(' ')).toContain('rollDefinitions[0].category must be one of');
  });
});
