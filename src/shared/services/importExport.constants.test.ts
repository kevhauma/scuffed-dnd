/**
 * Import/Export — constants
 *
 * Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-CST-01**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — constants round-trip (TICKET-CST-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  const withConstants = (): Configuration => ({
    ...validConfig,
    constants: [
      {
        id: 'id-div',
        name: 'bonus_divider',
        displayName: 'Bonus divider',
        description: 'Levels per point of bonus',
        value: 5,
      },
    ],
    stats: [
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: '10 / const.bonus_divider',
      },
    ],
  });

  it('survives export then import, formula and all', () => {
    const config = withConstants();
    const exported = serializeConfiguration(config);

    // The persisted formula points at the constant's id…
    expect(
      (JSON.parse(exported) as Configuration).stats.find((candidate) => candidate.formula)?.formula
    ).toBe('10 / const.[id-div]');
    // …and comes back spelled by name, with the constant itself intact
    expect(importConfiguration(exported)).toEqual(config);
  });

  it('accepts a file that predates the entity, leaving it absent', () => {
    const { constants: _dropped, ...legacy } = withConstants();

    expect(validateConfigurationShape(legacy).isValid).toBe(true);
  });

  it('rejects a constant with no description, a bad identifier, or a non-numeric value', () => {
    const broken = {
      ...withConstants(),
      constants: [
        { id: 'a', name: 'Bad Name', displayName: '', description: 'x', value: 1 },
        { id: 'b', name: 'ok_name', displayName: '', description: '', value: 1 },
        { id: 'c', name: 'also_ok', displayName: '', description: 'x', value: 'nope' },
      ],
    };

    const result = validateConfigurationShape(broken);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      'constants[0].name must be a lowercase identifier',
      'constants[1].description is required',
      'constants[2].value must be a number',
    ]);
  });
});
