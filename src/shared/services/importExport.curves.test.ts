/**
 * Import/Export — curves
 *
 * Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-CRV-01, TICKET-CRV-02**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — curves round-trip (TICKET-CRV-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  const withCurves = (): Configuration => ({
    ...validConfig,
    curves: [
      {
        id: 'id-xp',
        name: 'xp_thresholds',
        displayName: 'XP thresholds',
        description: 'Cumulative XP per level',
        keyName: 'level',
        columns: [{ id: 'col-xp', name: 'xp_required' }],
        rows: [
          { key: 1, values: [0] },
          { key: 2, values: [300] },
        ],
        interpolation: 'step',
        outOfRange: 'extrapolate',
        lookupDirection: 'reverse',
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
        formula: 'curve.xp_thresholds(10)',
      },
    ],
  });

  it('survives export then import, call and all', () => {
    const config = withCurves();
    const exported = serializeConfiguration(config);

    // The persisted formula points at the curve's id…
    expect(
      (JSON.parse(exported) as Configuration).stats.find((candidate) => candidate.formula)?.formula
    ).toBe('curve.[id-xp](10)');
    // …and comes back spelled by name, with the table intact
    expect(importConfiguration(exported)).toEqual(config);
  });

  it('accepts a file that predates the entity, leaving it absent', () => {
    const { curves: _dropped, ...legacy } = withCurves();

    expect(validateConfigurationShape(legacy).isValid).toBe(true);
  });

  it('rejects a curve with a bad identifier, an unknown mode, or a mis-sized row', () => {
    const [sound] = withCurves().curves ?? [];
    const broken = {
      ...withCurves(),
      curves: [
        { ...sound, id: 'a', name: 'Bad Name' },
        { ...sound, id: 'b', name: 'ok_name', interpolation: 'wobbly' },
        { ...sound, id: 'c', name: 'also_ok', rows: [{ key: 1, values: [0, 9] }] },
        { ...sound, id: 'd', name: 'third_ok', columns: [] },
      ],
    };

    const result = validateConfigurationShape(broken);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual([
      'curves[0].name must be a lowercase identifier',
      'curves[1].interpolation must be one of: step, linear',
      'curves[2].rows entries must have a numeric key and one value per column',
      'curves[3].columns must be a non-empty array',
      'curves[3].rows entries must have a numeric key and one value per column',
    ]);
  });

  it('rejects a curve missing a required text field, or a column not spelled as an identifier', () => {
    const [sound] = withCurves().curves ?? [];
    const { keyName: _dropped, ...noKeyName } = sound;

    const result = validateConfigurationShape({
      ...withCurves(),
      curves: [
        noKeyName,
        { ...sound, id: 'b', name: 'ok_name', columns: [{ id: 'c', name: 'Main Type' }] },
      ],
    });

    expect(result.errors).toEqual([
      'curves[0].keyName is required',
      'curves[1].columns entries must each have a lowercase identifier name',
    ]);
  });

  it('round-trips a generated column and its override flags (TICKET-CRV-02)', () => {
    const [sound] = withCurves().curves ?? [];
    const config: Configuration = {
      ...withCurves(),
      curves: [
        {
          ...sound,
          columns: [{ ...sound.columns[0], generator: 'key * 100' }],
          rows: [
            { key: 1, values: [0] },
            { key: 2, values: [42], overridden: [true] },
          ],
        },
      ],
    };

    expect(validateConfigurationShape(config).isValid).toBe(true);
    expect(importConfiguration(serializeConfiguration(config))).toEqual(config);
  });

  it('rejects a non-string generator or a non-boolean override flag', () => {
    const [sound] = withCurves().curves ?? [];
    const result = validateConfigurationShape({
      ...withCurves(),
      curves: [
        { ...sound, columns: [{ ...sound.columns[0], generator: 42 }] },
        {
          ...sound,
          id: 'b',
          name: 'ok_name',
          rows: [{ key: 1, values: [0], overridden: ['yes'] }],
        },
      ],
    });

    expect(result.errors).toEqual([
      'curves[0].columns generators must be strings when present',
      'curves[1].rows overridden must be an array of booleans, one per column at most',
    ]);
  });

  it('rejects an override flag for a column that does not exist', () => {
    const [sound] = withCurves().curves ?? [];
    const result = validateConfigurationShape({
      ...withCurves(),
      // One column, two flags — the extra one would be silently dropped
      curves: [{ ...sound, rows: [{ key: 1, values: [0], overridden: [true, true] }] }],
    });

    expect(result.errors).toContain(
      'curves[0].rows overridden must be an array of booleans, one per column at most'
    );
  });

  it('id-resolves a generator so it survives a rename on either side (TICKET-CRV-02)', () => {
    const [sound] = withCurves().curves ?? [];
    const config: Configuration = {
      ...withCurves(),
      constants: [
        {
          id: 'id-step',
          name: 'xp_step',
          displayName: 'XP step',
          description: 'XP per level',
          value: 300,
        },
      ],
      curves: [{ ...sound, columns: [{ ...sound.columns[0], generator: 'key * const.xp_step' }] }],
    };

    const exported = serializeConfiguration(config);

    expect((JSON.parse(exported) as Configuration).curves?.[0].columns[0].generator).toBe(
      'key * const.[id-step]'
    );
    expect(importConfiguration(exported)).toEqual(config);
  });

  it('rejects two curves claiming the same name', () => {
    const [sound] = withCurves().curves ?? [];
    const result = validateConfigurationShape({
      ...withCurves(),
      curves: [sound, { ...sound, id: 'other' }],
    });

    expect(result.errors).toContain('curves[1].name must be unique');
  });
});
