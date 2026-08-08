/**
 * Import/Export Service Tests
 *
 * Unit tests for configuration import/export functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toStoredConfiguration } from '../engine/formula/references';
import type { Configuration } from '../types/config';
import {
  downloadConfiguration,
  exportConfiguration,
  ImportExportError,
  importConfiguration,
  importConfigurationFromFile,
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
      mainSkills: [
        { id: 'STR', code: 'STR', name: 'Strength', description: 'Physical power', maxLevel: 10 },
        { id: 'DEX', code: 'DEX', name: 'Dexterity', description: 'Agility', maxLevel: 10 },
      ],
      stats: [{ id: 'health', name: 'Health', description: 'Hit points', formula: 'STR * 10' }],
      specialitySkills: [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat',
          maxBaseLevel: 10,
          bonusFormula: 'STR + DEX',
        },
      ],
      combatSkills: [
        {
          id: 'ATK',
          code: 'ATK',
          name: 'Attack',
          description: 'Basic attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 1 },
          bonusFormula: 'STR + MEL',
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

          // Everything but the formulas is carried through untouched…
          expect(parsed).toEqual({
            ...validConfig,
            stats: [{ ...validConfig.stats[0], formula: '[STR] * 10' }],
            specialitySkills: [
              { ...validConfig.specialitySkills[0], bonusFormula: '[STR] + [DEX]' },
            ],
            combatSkills: [{ ...validConfig.combatSkills[0], bonusFormula: '[STR] + [MEL]' }],
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

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
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
      const invalid = { ...validConfig, mainSkills: 'not an array' };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('mainSkills'))).toBe(true);
    });

    it('should validate main skill structure', () => {
      const invalid = {
        ...validConfig,
        mainSkills: [{ code: 'TOOLONG', name: 'Invalid', maxLevel: 10 }],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('3-letter'))).toBe(true);
    });

    it('should validate stat structure', () => {
      const invalid = {
        ...validConfig,
        stats: [{ id: 'test', name: 'Test' }], // Missing formula
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('formula'))).toBe(true);
    });

    it('should validate speciality skill structure', () => {
      const invalid = {
        ...validConfig,
        specialitySkills: [
          { code: 'AB', name: 'Invalid', bonusFormula: 'STR' }, // Code too short
        ],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('3-letter'))).toBe(true);
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

  describe('mainSkillPointBudget round-trip', () => {
    /** exportConfiguration returns a Blob, so a real round-trip has to read it back */
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(await exportConfiguration(config).text());

    it('should survive export then import unchanged', async () => {
      const withBudget: Configuration = { ...validConfig, mainSkillPointBudget: 25 };

      const imported = await roundTrip(withBudget);

      expect(imported.mainSkillPointBudget).toBe(25);
      expect(imported).toEqual(withBudget);
    });

    it('should import a file that predates the field, leaving it unlimited', () => {
      // validConfig has no mainSkillPointBudget — exactly the shape older exports have
      const imported = importConfiguration(JSON.stringify(validConfig));

      expect(imported.mainSkillPointBudget).toBeUndefined();
      expect(validateConfiguration(validConfig).isValid).toBe(true);
    });

    it('should round-trip a budget of zero rather than dropping it', async () => {
      const withNoPoints: Configuration = { ...validConfig, mainSkillPointBudget: 0 };

      const imported = await roundTrip(withNoPoints);

      expect(imported.mainSkillPointBudget).toBe(0);
    });

    it('should reject a non-numeric or negative budget', () => {
      const wrongType = { ...validConfig, mainSkillPointBudget: 'lots' };
      expect(validateConfiguration(wrongType).isValid).toBe(false);
      expect(validateConfiguration(wrongType).errors.join(' ')).toContain('mainSkillPointBudget');

      const negative = { ...validConfig, mainSkillPointBudget: -1 };
      expect(validateConfiguration(negative).isValid).toBe(false);
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
        { id: 'health', name: 'Health', description: '', formula: '10 / const.bonus_divider' },
      ],
    });

    it('survives export then import, formula and all', () => {
      const config = withConstants();
      const exported = exportedText(config);

      // The persisted formula points at the constant's id…
      expect((JSON.parse(exported) as Configuration).stats[0].formula).toBe('10 / const.[id-div]');
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
        { id: 'health', name: 'Health', description: '', formula: 'curve.xp_thresholds(10)' },
      ],
    });

    it('survives export then import, call and all', () => {
      const config = withCurves();
      const exported = exportedText(config);

      // The persisted formula points at the curve's id…
      expect((JSON.parse(exported) as Configuration).stats[0].formula).toBe('curve.[id-xp](10)');
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
