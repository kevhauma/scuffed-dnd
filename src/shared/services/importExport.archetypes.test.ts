/**
 * Import/Export — archetypes
 *
 * Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-ARC-01**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — archetypes (TICKET-ARC-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  const strong = {
    id: 'strong',
    name: 'Strong',
    description: '',
    statAffinity: { 'str-id': 'main' as const },
  };

  it('should accept a file with no archetypes key — absent means none', () => {
    expect(validateConfigurationShape(validConfig).isValid).toBe(true);
    expect('archetypes' in validConfig).toBe(false);
  });

  it('should round-trip an archetype unchanged', async () => {
    const withArchetype: Configuration = { ...validConfig, archetypes: [strong] };

    const imported = importConfiguration(serializeConfiguration(withArchetype));

    expect(imported.archetypes).toEqual([strong]);
  });

  it('should reject archetypes that is not an array', () => {
    const result = validateConfigurationShape({ ...validConfig, archetypes: 'lots' });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('archetypes');
  });

  it('should reject an archetype missing its identity fields', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      archetypes: [{ statAffinity: {} }],
    });

    expect(result.errors.join(' ')).toContain('archetypes[0].id must be a string');
    expect(result.errors.join(' ')).toContain('archetypes[0].name must be a string');
  });

  it('should reject a statAffinity that is not an object keyed by stat id', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      archetypes: [{ ...strong, statAffinity: ['main'] }],
    });

    expect(result.errors.join(' ')).toContain('archetypes[0].statAffinity must be an object');
  });

  it('should reject an affinity outside the three Concept 03 values', () => {
    const result = validateConfigurationShape({
      ...validConfig,
      archetypes: [{ ...strong, statAffinity: { 'str-id': 'favourite' } }],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('archetypes[0].statAffinity.str-id');
  });
});
