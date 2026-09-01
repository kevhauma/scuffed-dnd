/**
 * Import/Export — passive abilities
 *
 * The catalog on the wire (v4 systems/14, TICKET-PAS-01), and the seventh per-entity file of the
 * split — see `importExport.test.ts`'s header for the two rules that keep it mechanical.
 *
 * **A gate with almost nothing to say, and that is the entity being honest.** The source tab has
 * two columns, so there are two fields; neither is optional and only one of them can look like an
 * omission — an empty `effectText`, which is a passive somebody has named and not yet described.
 * The one thing this file does check hard is that a **templated** effect survives byte-for-byte: an
 * importer that trimmed, escaped or normalised braces would silently change what two of the
 * workbook's 26 rows compute.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; v4 systems/14, TICKET-PAS-01**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — passives (v4 systems/14, TICKET-PAS-01)', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  /** A plain row of the sheet: a name and a sentence that computes nothing */
  const charmImmunity = {
    id: 'passive-charmed',
    name: 'Charm immunity',
    effectText: 'You cannot be charmed.',
  };

  /** One of the two rows that are live formulas */
  const blindsight = {
    id: 'passive-blindsight',
    name: 'Blindsight',
    effectText: 'You have blindsight out to {skills.perception.level * 10} feet.',
  };

  const withPassives = (passives: unknown): Configuration =>
    ({ ...validConfig, passives }) as Configuration;

  it('should accept a file with no passives key — absent means none', () => {
    const noPassives: Record<string, unknown> = { ...validConfig };
    delete noPassives.passives;

    expect(validateConfigurationShape(noPassives).isValid).toBe(true);
    expect('passives' in noPassives).toBe(false);
  });

  it('should leave a ruleset with no passives without one after a round-trip', () => {
    const exported = serializeConfiguration(validConfig);
    const imported = importConfiguration(exported);

    expect(imported).not.toHaveProperty('passives');
  });

  it('should round-trip a plain-prose passive unchanged', () => {
    const imported = importConfiguration(serializeConfiguration(withPassives([charmImmunity])));

    expect(imported.passives).toEqual([charmImmunity]);
  });

  it('should round-trip a templated effect with its braces intact', () => {
    // The stored form resolves the reference inside the braces to an id and the display form spells
    // it back; what must not happen is the *prose* changing or the braces being escaped away
    const imported = importConfiguration(serializeConfiguration(withPassives([blindsight])));

    expect(imported.passives?.[0].effectText).toContain('{');
    expect(imported.passives?.[0].effectText).toContain('feet.');
  });

  it('should round-trip an empty effect without inventing text for it', () => {
    const unwritten = { ...charmImmunity, id: 'passive-unwritten', effectText: '' };

    const imported = importConfiguration(serializeConfiguration(withPassives([unwritten])));

    expect(imported.passives).toEqual([unwritten]);
    expect(imported.passives?.[0].effectText).toBe('');
  });

  it('should keep two passives that share a name, because the sheet has four such rows', () => {
    // The poison-resistance ladder appears twice, rows 7-10 and 15-18, with slightly different
    // wording. The sheet wins (v4 D1): duplicate names survive, and only duplicate **ids** are a
    // defect — which is `engine/validator.ts`'s report rather than this gate's.
    const doubled = [
      { id: 'passive-poison-a', name: 'Poison resistance', effectText: 'You take half damage.' },
      { id: 'passive-poison-b', name: 'Poison resistance', effectText: 'You resist poison.' },
    ];

    const imported = importConfiguration(serializeConfiguration(withPassives(doubled)));

    expect(imported.passives).toEqual(doubled);
  });

  it('should refuse a passive with no id', () => {
    const { id: _missing, ...idless } = charmImmunity;

    const result = validateConfigurationShape(withPassives([idless]));

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('id');
  });

  it('should refuse an effect that is not a string', () => {
    // A number here would reach `templateFormulas` and `resolveTemplate` as a non-string; refusing
    // it at the gate is what keeps every reader below able to assume text
    const result = validateConfigurationShape(withPassives([{ ...charmImmunity, effectText: 7 }]));

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('effectText');
  });

  it('should refuse a passives key that is not an array', () => {
    expect(validateConfigurationShape(withPassives({ blindsight })).isValid).toBe(false);
  });
});
