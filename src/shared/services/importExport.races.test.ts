/**
 * Import/Export — races
 *
 * The stat block on the wire, and the creature identity fields beside it. Split out of
 * `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-RACE-01, TICKET-RACE-03**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — races', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('race stat blocks (TICKET-RACE-01)', () => {
    const withRaces = (races: unknown) => validateConfigurationShape({ ...validConfig, races });

    it('should accept a block keyed by stat id, and an empty one', () => {
      const result = withRaces([
        { id: 'elf', name: 'Elf', description: '', statValues: { 'id-str': 12 } },
        { id: 'empty', name: 'Empty', description: '', statValues: {} },
      ]);

      expect(result).toEqual({ isValid: true, errors: [] });
    });

    it('should reject a race that still carries v1 modifiers', () => {
      const result = withRaces([{ id: 'elf', name: 'Elf', description: '', skillModifiers: [] }]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('races[0].statValues must be an object keyed by stat id');
    });

    it('should reject a non-numeric entry rather than coercing it', () => {
      const result = withRaces([
        { id: 'elf', name: 'Elf', description: '', statValues: { 'id-str': '12' } },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('races[0].statValues.id-str must be a finite number');
    });

    it('should reject an array in place of the block, which JSON makes easy to confuse', () => {
      const result = withRaces([{ id: 'elf', name: 'Elf', description: '', statValues: [] }]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('races[0].statValues must be an object keyed by stat id');
    });
  });

  describe('race stat block round-trip (TICKET-RACE-01)', () => {
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(serializeConfiguration(config));

    it('should survive export then import unchanged', async () => {
      const withRaces: Configuration = {
        ...validConfig,
        races: [
          { id: 'dwarf', name: 'Dwarf', description: 'Stout', statValues: { 'id-str': 14 } },
          { id: 'empty', name: 'Empty', description: '', statValues: {} },
        ],
      };

      const imported = await roundTrip(withRaces);

      expect(imported.races).toEqual(withRaces.races);
    });

    it('should keep the block spelled in stat ids on the wire, not in abbreviations', async () => {
      // The export is the reference-form boundary: a formula comes back as ids, and a stat block
      // was already ids — so it passes through untranslated, and a rename cannot orphan it
      const withRaces: Configuration = {
        ...validConfig,
        races: [{ id: 'dwarf', name: 'Dwarf', description: '', statValues: { 'id-str': 14 } }],
      };

      const raw = JSON.parse(serializeConfiguration(withRaces));

      expect(raw.races[0].statValues).toEqual({ 'id-str': 14 });
    });
  });

  describe('creature identity and the reference lists (TICKET-RACE-03)', () => {
    const roundTrip = (config: Configuration): Configuration =>
      importConfiguration(serializeConfiguration(config));

    it('should round-trip a v3-shape ruleset unchanged, so the fields cost nothing to not have', () => {
      // Additive-optional throughout: no `type`, no `size`, no `challengeRate`, neither list — and
      // nothing grows one on the way through. This is why the ticket needs no version bump.
      const withRaces: Configuration = {
        ...validConfig,
        races: [{ id: 'dwarf', name: 'Dwarf', description: 'Stout', statValues: { 'id-str': 14 } }],
      };

      const imported = roundTrip(withRaces);

      expect(imported.races).toEqual(withRaces.races);
      expect('type' in imported.races[0]).toBe(false);
      expect('creatureSizes' in imported).toBe(false);
      expect('creatureTypes' in imported).toBe(false);
    });

    it('should round-trip the identity fields and both lists', () => {
      const withIdentity: Configuration = {
        ...validConfig,
        // The workbook's own spellings, kept: the sheet wins (overview D1)
        creatureSizes: ['tiny', 'small', 'medium', 'guargantian'],
        creatureTypes: ['humaniod', 'construct', 'Ooze'],
        races: [
          {
            id: 'dwarf',
            name: 'Dwarf',
            description: 'Stout',
            statValues: { 'id-str': 14 },
            type: 'humaniod',
            size: 'small',
            challengeRate: 0,
          },
        ],
      };

      const imported = roundTrip(withIdentity);

      expect(imported.races).toEqual(withIdentity.races);
      expect(imported.creatureSizes).toEqual(withIdentity.creatureSizes);
      expect(imported.creatureTypes).toEqual(withIdentity.creatureTypes);
    });

    it('should keep a challenge rate of 0, which is what every playable race has', () => {
      // `0` is the value the whole field exists to record, so a falsy-check anywhere on the path
      // would erase exactly the data there is
      const withRate: Configuration = {
        ...validConfig,
        races: [{ id: 'dwarf', name: 'Dwarf', description: '', statValues: {}, challengeRate: 0 }],
      };

      expect(roundTrip(withRate).races[0].challengeRate).toBe(0);
    });

    it('should refuse an identity field of the wrong kind', () => {
      const config = {
        ...validConfig,
        races: [{ id: 'dwarf', name: 'Dwarf', description: '', statValues: {}, type: 7 }],
      };

      const result = validateConfigurationShape(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('races[0].type must be a string when present');
    });

    it('should refuse a reference list that is not a list of words', () => {
      const notAList = validateConfigurationShape({ ...validConfig, creatureSizes: 'medium' });
      const notWords = validateConfigurationShape({ ...validConfig, creatureTypes: [1, 2] });

      expect(notAList.errors).toContain(
        "Field 'creatureSizes' must be an array of creature sizes when present"
      );
      expect(notWords.errors).toContain(
        "Field 'creatureTypes' must be an array of creature types when present"
      );
    });

    it('should accept a race naming a word neither list offers — that is the validator’s finding', () => {
      // The shape gate checks kinds; whether the word is in the ruleset's vocabulary is
      // `engine/validator.ts`'s warning, because a mismatch still renders and still plays
      const config: Configuration = {
        ...validConfig,
        creatureTypes: ['humaniod'],
        races: [{ id: 'x', name: 'X', description: '', statValues: {}, type: 'fey' }],
      };

      expect(validateConfigurationShape(config).isValid).toBe(true);
    });
  });
});
