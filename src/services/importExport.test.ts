/**
 * Import/Export Service Tests
 *
 * Unit tests for configuration import/export functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '../engine/formula/references';
import type { Configuration } from '../types/config';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import {
  downloadConfiguration,
  downloadStoredBackup,
  exportConfiguration,
  ImportExportError,
  importConfiguration,
  importConfigurationFromFile,
  SchemaVersionError,
  ValidationError,
  validateConfiguration,
} from './importExport';

/** The JSON an export writes, without going through FileReader */
function exportedText(config: Configuration): string {
  return JSON.stringify(toStoredConfiguration(config), null, 2);
}

describe('Import/Export Service', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = {
      id: 'test-config',
      name: 'Test Config',
      version: '1.0.0',
      schemaVersion: 7,
      stats: [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: 'Physical power',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'DEX',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: 'Agility',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'health',
          name: 'Health',
          abbreviation: 'HEA',
          description: 'Hit points',
          order: 0,
          countsTowardTotal: true,
          isResource: true,
          rounding: 'none',
          formula: 'STR * 10',
        },
      ],
      skills: [
        {
          id: 'MEL',
          name: 'Melee',
          description: 'Close combat',
          statWeights: [
            { statId: 'STR', weight: 0.2 },
            { statId: 'DEX', weight: 0.1 },
          ],
        },
      ],
      combatSkills: [
        {
          id: 'ATK',
          code: 'ATK',
          name: 'Attack',
          description: 'Basic attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 1 },
          bonusFormula: 'STR + skills.melee',
        },
      ],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 2,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
  });

  describe('exportConfiguration', () => {
    it('should export configuration as JSON blob', () => {
      const blob = exportConfiguration(validConfig);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should create valid JSON content, with references resolved to ids (TICKET-REF-01)', () => {
      const blob = exportConfiguration(validConfig);

      // Read blob content using FileReader-like approach
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const text = reader.result as string;
          const parsed = JSON.parse(text) as Configuration;

          // Everything but the formulas is carried through untouched. A skill's weight rows are
          // keyed by stat id already, so there is nothing in them to resolve (TICKET-SKL-02).
          expect(parsed).toEqual({
            ...validConfig,
            stats: validConfig.stats.map((stat) =>
              stat.formula ? { ...stat, formula: '[STR] * 10' } : stat
            ),
            combatSkills: [
              { ...validConfig.combatSkills[0], bonusFormula: '[STR] + skills.[MEL]' },
            ],
          });

          // …and importing the file spells them the way this ruleset spells them again
          expect(importConfiguration(text)).toEqual(validConfig);
          resolve();
        };
        reader.readAsText(blob);
      });
    });

    it('should format JSON with indentation', () => {
      const blob = exportConfiguration(validConfig);

      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const text = reader.result as string;
          // Check for indentation (formatted JSON has newlines and spaces)
          expect(text).toContain('\n');
          expect(text).toContain('  ');
          resolve();
        };
        reader.readAsText(blob);
      });
    });
  });

  describe('downloadConfiguration', () => {
    beforeEach(() => {
      // Mock DOM methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      document.createElement = vi.fn((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: vi.fn(),
          } as unknown as HTMLAnchorElement;
        }
        return {} as HTMLElement;
      });
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
    });

    it('should trigger download with default filename', () => {
      downloadConfiguration(validConfig);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should use custom filename when provided', () => {
      const customFilename = 'my-config.json';
      const createElementSpy = vi.spyOn(document, 'createElement');

      downloadConfiguration(validConfig, customFilename);

      const linkElement = createElementSpy.mock.results[0]?.value as HTMLAnchorElement;
      expect(linkElement.download).toBe(customFilename);
    });

    it('should clean up URL after download', () => {
      downloadConfiguration(validConfig);

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('downloadStoredBackup (TICKET-IO-03)', () => {
    /** The blob handed to the browser, so the file's actual bytes can be read back */
    let downloaded: Blob | null;

    beforeEach(() => {
      downloaded = null;
      localStorage.clear();
      global.URL.createObjectURL = vi.fn((blob: Blob) => {
        downloaded = blob;
        return 'blob:mock-url';
      });
      global.URL.revokeObjectURL = vi.fn();
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    });

    it('writes both stored blobs into one file, byte for byte', async () => {
      // Deliberately ugly spacing — a re-serialised backup would lose it
      localStorage.setItem('dnd_builder_config', '{ "id":"old",  "name" : "Old Ruleset" }');
      localStorage.setItem('dnd_builder_characters', '[ {"id":"aria"} ]');

      downloadStoredBackup();

      const text = await downloaded?.text();
      expect(text).toContain('{ "id":"old",  "name" : "Old Ruleset" }');
      expect(text).toContain('[ {"id":"aria"} ]');
      // And it is still a file anything can read
      expect(JSON.parse(text ?? '').dnd_builder_config).toEqual({ id: 'old', name: 'Old Ruleset' });
    });

    it('names the file with a timestamp unless told otherwise', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      downloadStoredBackup();

      const link = createElementSpy.mock.results[0]?.value as HTMLAnchorElement;
      expect(link.download).toMatch(/^dnd_builder_backup_\d+\.json$/);
    });

    it('writes an absent key as null rather than as an empty value', async () => {
      localStorage.setItem('dnd_builder_config', '{"id":"old"}');

      downloadStoredBackup();

      const parsed = JSON.parse((await downloaded?.text()) ?? '');
      expect(parsed.dnd_builder_characters).toBeNull();
    });

    it('still produces a readable file when a stored blob is corrupt', async () => {
      // Reachable: the refusal branch validates the configuration and never parses the characters
      localStorage.setItem('dnd_builder_config', '{"id":"old"}');
      localStorage.setItem('dnd_builder_characters', '[ {broken');

      downloadStoredBackup();

      const parsed = JSON.parse((await downloaded?.text()) ?? '');
      // Carried out intact as a string — the one file the User is told to keep must parse
      expect(parsed.dnd_builder_characters).toBe('[ {broken');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('race stat blocks (TICKET-RACE-01)', () => {
      const withRaces = (races: unknown) => validateConfiguration({ ...validConfig, races });

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

    it('should reject non-object data', () => {
      const result = validateConfiguration('not an object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should reject null data', () => {
      const result = validateConfiguration(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should validate required string fields', () => {
      const invalid = { ...validConfig, name: 123 };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('should validate required number fields', () => {
      const invalid = { ...validConfig, focusStatBonusLevel: 'not a number' };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('focusStatBonusLevel'))).toBe(true);
    });

    it('should validate required array fields', () => {
      const invalid = { ...validConfig, stats: 'not an array' };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('stats'))).toBe(true);
    });

    it('should validate stat structure', () => {
      // Missing everything the unified stat requires (TICKET-STAT-01) — a formula is *not*
      // among them, since an invested stat has none
      const invalid = {
        ...validConfig,
        stats: [{ id: 'test', name: 'Test' }],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('abbreviation'))).toBe(true);
      expect(result.errors.some((e) => e.includes('rounding'))).toBe(true);
    });

    it('should accept a stat with no formula — that is what makes it invested', () => {
      const result = validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
    });

    it('should validate skill structure (TICKET-SKL-02)', () => {
      // A file still holding v1's `{ code, bonusFormula }` is reported by name rather than
      // importing as a skill derived from nothing
      const invalid = {
        ...validConfig,
        skills: [{ code: 'AB', name: 'Invalid', bonusFormula: 'STR' }],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('skills[0].statWeights must be an array');
    });

    it('should reject a weight row that names no stat or carries no number', () => {
      const invalid = {
        ...validConfig,
        skills: [
          {
            id: 'MEL',
            name: 'Melee',
            description: '',
            statWeights: [{ statId: '', weight: 'heavy' }],
          },
        ],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('skills[0].statWeights[0].statId must be a stat id');
      expect(result.errors).toContain('skills[0].statWeights[0].weight must be a finite number');
    });

    it('should validate combat skill structure', () => {
      const invalid = {
        ...validConfig,
        combatSkills: [
          { code: 'ATK', name: 'Attack', bonusFormula: 'STR' }, // Missing dice
        ],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('dice'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const invalid = {
        ...validConfig,
        name: 123,
        focusStatBonusLevel: 'invalid',
        mainSkills: 'not an array',
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('importConfiguration', () => {
    it('should import valid JSON configuration', () => {
      const json = JSON.stringify(validConfig);
      const imported = importConfiguration(json);

      expect(imported).toEqual(validConfig);
    });

    it('should throw ValidationError for invalid configuration', () => {
      const invalid = { ...validConfig, name: 123 };
      const json = JSON.stringify(invalid);

      expect(() => importConfiguration(json)).toThrow(ValidationError);
    });

    it('should throw ImportExportError for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => importConfiguration(invalidJson)).toThrow(ImportExportError);
      expect(() => importConfiguration(invalidJson)).toThrow('Invalid JSON format');
    });

    it('should include validation errors in ValidationError', () => {
      const invalid = { ...validConfig, name: 123, focusStatBonusLevel: 'invalid' };
      const json = JSON.stringify(invalid);

      try {
        importConfiguration(json);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('the clean break on imported files (TICKET-IO-03)', () => {
    /** A file as v1 exported it: main skills, no `schemaVersion` */
    const v1File = JSON.stringify({
      id: 'old',
      name: 'Old Ruleset',
      version: '1.0.0',
      mainSkills: [{ id: 'id-str', code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
      stats: [{ id: 'id-hp', name: 'Health', description: '', formula: 'STR * 10' }],
      skills: [],
      combatSkills: [],
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
      focusStatBonusLevel: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    });

    it('refuses a v1 file with a version message, not a field-by-field report', () => {
      expect(() => importConfiguration(v1File)).toThrow(SchemaVersionError);
      expect(() => importConfiguration(v1File)).toThrow(/older version of the app/);

      // Not a ValidationError: "this is from the old app" and "this is malformed" are different
      // problems, and thirty missing-field complaints would read as a corrupt export
      expect(() => importConfiguration(v1File)).not.toThrow(ValidationError);
    });

    it('reports what the file claimed to be', () => {
      try {
        importConfiguration(v1File);
        expect.fail('Should have thrown SchemaVersionError');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaVersionError);
        if (error instanceof SchemaVersionError) {
          expect(error.foundVersion).toBeUndefined();
        }
      }
    });

    it('keeps the generic rejection generic: a corrupt file is still an invalid-JSON error', () => {
      expect(() => importConfiguration('{ not json at all')).toThrow('Invalid JSON format');
      expect(() => importConfiguration('{ not json at all')).not.toThrow(SchemaVersionError);
    });

    it('applies a current file', () => {
      expect(importConfiguration(JSON.stringify(validConfig))).toEqual(validConfig);
    });

    it('refuses a future shape by the same gate', () => {
      // Read off the constant rather than written out: this milestone bumps the version on every
      // reshape, and a literal here would turn each bump into a false failure
      const future = JSON.stringify({
        ...validConfig,
        schemaVersion: SUPPORTED_SCHEMA_VERSION + 1,
      });

      expect(() => importConfiguration(future)).toThrow(SchemaVersionError);
    });

    it('refuses a stale in-milestone shape by the same gate (TICKET-RACE-01)', () => {
      // v2 was the unified-stat shape, before a race became a stat block. It is not a "future"
      // file and not a v1 file — it is a shape this build genuinely cannot read, and the version
      // gate is what turns that into a notice instead of a crash on a field that moved.
      const staleV2 = JSON.stringify({
        ...validConfig,
        schemaVersion: 2,
        races: [{ id: 'elf', name: 'Elf', description: '', skillModifiers: [] }],
      });

      expect(() => importConfiguration(staleV2)).toThrow(SchemaVersionError);
      expect(() => importConfiguration(staleV2)).not.toThrow(ValidationError);
    });

    it('refuses the shape before per-stat material modifiers (TICKET-MAT-01)', () => {
      // v3 tier bonuses named a skill code. Reading one as a `statId` would import a modifier
      // that targets nothing at all, so the version gate stops it before the shape check does.
      const staleV3 = JSON.stringify({
        ...validConfig,
        schemaVersion: 3,
        materials: [
          {
            id: 'mat1',
            name: 'Iron',
            description: '',
            categoryId: 'cat1',
            levels: [
              {
                level: 1,
                name: 'Iron',
                bonuses: [{ skillCode: 'STR', modifier: 2 }],
                value: { tierId: 'gold', amount: 1 },
              },
            ],
          },
        ],
      });

      expect(() => importConfiguration(staleV3)).toThrow(SchemaVersionError);
      expect(() => importConfiguration(staleV3)).not.toThrow(ValidationError);
    });

    it('exports the version it imports, so the round-trip survives the gate', async () => {
      const exported = await exportConfiguration(validConfig).text();

      expect(JSON.parse(exported).schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
      expect(importConfiguration(exported)).toEqual(validConfig);
    });
  });

  describe('race stat block round-trip (TICKET-RACE-01)', () => {
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(await exportConfiguration(config).text());

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

      const raw = JSON.parse(await exportConfiguration(withRaces).text());

      expect(raw.races[0].statValues).toEqual({ 'id-str': 14 });
    });
  });

  describe('material stat modifier round-trip (TICKET-MAT-01)', () => {
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(await exportConfiguration(config).text());

    /** A ruleset whose one material tier modifies a stat */
    const withMaterials = (bonuses: unknown[]): Configuration =>
      ({
        ...validConfig,
        materialCategories: [{ id: 'cat1', name: 'Metals', description: '' }],
        currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
        materials: [
          {
            id: 'mat1',
            name: 'Iron',
            description: '',
            categoryId: 'cat1',
            levels: [
              {
                level: 1,
                name: 'Iron',
                bonuses,
                value: { tierId: 'gold', amount: 10 },
              },
            ],
          },
        ],
      }) as Configuration;

    it('should survive export then import unchanged', async () => {
      const config = withMaterials([{ statId: 'id-str', modifier: 50 }]);

      const imported = await roundTrip(config);

      expect(imported.materials).toEqual(config.materials);
    });

    it('should keep the modifier spelled in stat ids on the wire, not in abbreviations', async () => {
      // Like a race's stat block, a tier modifier is already an id, so it crosses the
      // reference-form boundary untranslated and a rename cannot orphan it
      const config = withMaterials([{ statId: 'id-str', modifier: 50 }]);

      const raw = JSON.parse(await exportConfiguration(config).text());

      expect(raw.materials[0].levels[0].bonuses).toEqual([{ statId: 'id-str', modifier: 50 }]);
    });

    it('should reject a tier bonus that is not { statId, modifier }', () => {
      const oldShape = JSON.stringify(withMaterials([{ skillCode: 'STR', modifier: 2 }]));
      const badNumber = JSON.stringify(withMaterials([{ statId: 'id-str', modifier: 'a lot' }]));

      expect(() => importConfiguration(oldShape)).toThrow(ValidationError);
      expect(() => importConfiguration(badNumber)).toThrow(ValidationError);
    });
  });

  describe('archetypes (TICKET-ARC-01)', () => {
    const strong = {
      id: 'strong',
      name: 'Strong',
      description: '',
      statAffinity: { 'str-id': 'main' as const },
    };

    it('should accept a file with no archetypes key — absent means none', () => {
      expect(validateConfiguration(validConfig).isValid).toBe(true);
      expect('archetypes' in validConfig).toBe(false);
    });

    it('should round-trip an archetype unchanged', async () => {
      const withArchetype: Configuration = { ...validConfig, archetypes: [strong] };

      const imported = importConfiguration(await exportConfiguration(withArchetype).text());

      expect(imported.archetypes).toEqual([strong]);
    });

    it('should reject archetypes that is not an array', () => {
      const result = validateConfiguration({ ...validConfig, archetypes: 'lots' });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('archetypes');
    });

    it('should reject an archetype missing its identity fields', () => {
      const result = validateConfiguration({
        ...validConfig,
        archetypes: [{ statAffinity: {} }],
      });

      expect(result.errors.join(' ')).toContain('archetypes[0].id must be a string');
      expect(result.errors.join(' ')).toContain('archetypes[0].name must be a string');
    });

    it('should reject a statAffinity that is not an object keyed by stat id', () => {
      const result = validateConfiguration({
        ...validConfig,
        archetypes: [{ ...strong, statAffinity: ['main'] }],
      });

      expect(result.errors.join(' ')).toContain('archetypes[0].statAffinity must be an object');
    });

    it('should reject an affinity outside the three Concept 03 values', () => {
      const result = validateConfiguration({
        ...validConfig,
        archetypes: [{ ...strong, statAffinity: { 'str-id': 'favourite' } }],
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('archetypes[0].statAffinity.str-id');
    });
  });

  describe('retired fields (TICKET-RES-02)', () => {
    it('should reject a file still carrying mainSkillPointBudget rather than ignoring it', () => {
      const withRetiredField = { ...validConfig, mainSkillPointBudget: 25 };

      const result = validateConfiguration(withRetiredField);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('mainSkillPointBudget');
      expect(() => importConfiguration(JSON.stringify(withRetiredField))).toThrow(ValidationError);
    });

    it('should name what replaced the field, not just refuse it', () => {
      const withRetiredField = { ...validConfig, mainSkillPointBudget: 25 };

      expect(validateConfiguration(withRetiredField).errors.join(' ')).toContain(
        'points_per_level'
      );
    });

    it('should reject a retired field whatever its value, including zero', () => {
      // The old shape allowed 0 ("no points"), so a file holding it is exactly as stale as one
      // holding 25 — a falsy value must not slip through the presence check
      expect(validateConfiguration({ ...validConfig, mainSkillPointBudget: 0 }).isValid).toBe(
        false
      );
    });

    it('should accept a file on the current shape, which carries no such field', () => {
      expect(validateConfiguration(validConfig).isValid).toBe(true);
      expect('mainSkillPointBudget' in validConfig).toBe(false);
    });
  });

  describe('importConfigurationFromFile', () => {
    it('should import configuration from file', async () => {
      const json = JSON.stringify(validConfig);
      const blob = new Blob([json], { type: 'application/json' });

      // Create a mock file with text() method
      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => json,
      }) as File;

      const imported = await importConfigurationFromFile(file);

      expect(imported).toEqual(validConfig);
    });

    it('should throw ValidationError for invalid file content', async () => {
      const invalid = { ...validConfig, name: 123 };
      const json = JSON.stringify(invalid);
      const blob = new Blob([json], { type: 'application/json' });

      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => json,
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ValidationError);
    });

    it('should throw ImportExportError for invalid JSON in file', async () => {
      const invalidJson = '{ invalid json }';
      const blob = new Blob([invalidJson], { type: 'application/json' });

      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => invalidJson,
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ImportExportError);
    });

    it('should handle file read errors', async () => {
      const blob = new Blob(['test'], { type: 'application/json' });

      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => {
          throw new Error('Read error');
        },
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ImportExportError);
    });
  });
  describe('constants round-trip (TICKET-CST-01)', () => {
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
      const exported = exportedText(config);

      // The persisted formula points at the constant's id…
      expect(
        (JSON.parse(exported) as Configuration).stats.find((candidate) => candidate.formula)
          ?.formula
      ).toBe('10 / const.[id-div]');
      // …and comes back spelled by name, with the constant itself intact
      expect(importConfiguration(exported)).toEqual(config);
    });

    it('accepts a file that predates the entity, leaving it absent', () => {
      const { constants: _dropped, ...legacy } = withConstants();

      expect(validateConfiguration(legacy).isValid).toBe(true);
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

      const result = validateConfiguration(broken);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([
        'constants[0].name must be a lowercase identifier',
        'constants[1].description is required',
        'constants[2].value must be a number',
      ]);
    });
  });

  describe('curves round-trip (TICKET-CRV-01)', () => {
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
      const exported = exportedText(config);

      // The persisted formula points at the curve's id…
      expect(
        (JSON.parse(exported) as Configuration).stats.find((candidate) => candidate.formula)
          ?.formula
      ).toBe('curve.[id-xp](10)');
      // …and comes back spelled by name, with the table intact
      expect(importConfiguration(exported)).toEqual(config);
    });

    it('accepts a file that predates the entity, leaving it absent', () => {
      const { curves: _dropped, ...legacy } = withCurves();

      expect(validateConfiguration(legacy).isValid).toBe(true);
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

      const result = validateConfiguration(broken);

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

      const result = validateConfiguration({
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

      expect(validateConfiguration(config).isValid).toBe(true);
      expect(importConfiguration(exportedText(config))).toEqual(config);
    });

    it('rejects a non-string generator or a non-boolean override flag', () => {
      const [sound] = withCurves().curves ?? [];
      const result = validateConfiguration({
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
      const result = validateConfiguration({
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
        curves: [
          { ...sound, columns: [{ ...sound.columns[0], generator: 'key * const.xp_step' }] },
        ],
      };

      const exported = exportedText(config);

      expect((JSON.parse(exported) as Configuration).curves?.[0].columns[0].generator).toBe(
        'key * const.[id-step]'
      );
      expect(importConfiguration(exported)).toEqual(config);
    });

    it('rejects two curves claiming the same name', () => {
      const [sound] = withCurves().curves ?? [];
      const result = validateConfiguration({
        ...withCurves(),
        curves: [sound, { ...sound, id: 'other' }],
      });

      expect(result.errors).toContain('curves[1].name must be unique');
    });
  });
});
