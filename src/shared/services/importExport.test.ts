/**
 * Import/Export Service Tests — the pure half
 *
 * Serialising, parsing, version gating, validation and the reference round-trip. The `Blob`,
 * download-anchor and `File` behaviour moved to `client/services/configFiles.test.ts` when
 * TICKET-DX-07 split the service along the browser-API seam; both halves are written against the
 * same fixture so neither can drift.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import {
  ImportExportError,
  importConfiguration,
  SchemaVersionError,
  serializeConfiguration,
  ValidationError,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export Service', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('validateConfigurationShape', () => {
    it('should validate correct configuration', () => {
      const result = validateConfigurationShape(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
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

    describe('the equipment grid and its placements (TICKET-INV-03)', () => {
      const shapeOf = (overrides: Record<string, unknown>) =>
        validateConfigurationShape({ ...validConfig, ...overrides });

      const placed = (placement: unknown) => ({
        equipmentSlots: [{ type: 'head', name: 'Head', description: '', placement }],
      });

      it('accepts a ruleset with no layout and no placements — the pre-builder shape', () => {
        expect(shapeOf({})).toEqual({ isValid: true, errors: [] });
      });

      it('accepts a grid with slots placed on it', () => {
        const result = shapeOf({
          equipmentLayout: { columns: 3, rows: 4 },
          ...placed({ column: 2, row: 1, glyph: 'helm' }),
        });

        expect(result).toEqual({ isValid: true, errors: [] });
      });

      it('rejects a grid larger than the app can draw', () => {
        const result = shapeOf({ equipmentLayout: { columns: 7, rows: 4 } });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'equipmentLayout.columns must be a whole number from 1 to 6'
        );
      });

      it('rejects a grid that is not a { columns, rows } object', () => {
        const result = shapeOf({ equipmentLayout: [3, 4] });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Field 'equipmentLayout' must be a { columns, rows } object when present"
        );
      });

      it('rejects a cell that is not a whole number from 1 up', () => {
        // A fractional or zero column places nothing and reports nothing — the tile simply stops
        // being drawn, which is the silence this check exists to break
        const result = shapeOf(placed({ column: 1.5, row: 0, glyph: 'helm' }));

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'equipmentSlots[0].placement.column must be a whole number from 1 up'
        );
        expect(result.errors).toContain(
          'equipmentSlots[0].placement.row must be a whole number from 1 up'
        );
      });

      it('rejects a glyph the app has no drawing for', () => {
        const result = shapeOf(placed({ column: 1, row: 1, glyph: 'dragon' }));

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'equipmentSlots[0].placement.glyph must be a glyph the app can draw'
        );
      });

      it('rejects a placement that is not an object', () => {
        const result = shapeOf(placed('column 2'));

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'equipmentSlots[0].placement must be a { column, row, glyph } object when present'
        );
      });
    });

    describe('the four collections that were array-checked and nothing more (CR-03)', () => {
      const shapeOf = (overrides: Record<string, unknown>) =>
        validateConfigurationShape({ ...validConfig, ...overrides });

      it('rejects a null entry in any of them rather than letting it reach the engine', () => {
        for (const field of ['items', 'equipmentSlots', 'currencyTiers', 'materialCategories']) {
          const result = shapeOf({ [field]: [null] });

          expect(result.isValid, field).toBe(false);
          expect(result.errors, field).toContain(`${field}[0] must be an object`);
        }
      });

      it('rejects an item whose optional reference is not a string', () => {
        const result = shapeOf({
          items: [{ id: 'boots', name: 'Boots', description: '', equipmentSlotType: 7 }],
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('items[0].equipmentSlotType must be a string when present');
      });

      it('accepts a plain item, which carries no references at all', () => {
        const result = shapeOf({ items: [{ id: 'rope', name: 'Rope', description: '' }] });

        expect(result).toEqual({ isValid: true, errors: [] });
      });

      it('rejects an equipment slot with no type, which nothing could ever be equipped to', () => {
        const result = shapeOf({ equipmentSlots: [{ type: '', name: 'Head', description: '' }] });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('equipmentSlots[0].type must be a non-empty string');
      });

      it('rejects a currency tier whose ladder numbers are not numbers', () => {
        const result = shapeOf({
          currencyTiers: [{ id: 'gold', name: 'Gold', order: '0', conversionToNext: null }],
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('currencyTiers[0].order must be a finite number');
        expect(result.errors).toContain(
          'currencyTiers[0].conversionToNext must be a finite number'
        );
      });

      it('rejects a material category missing its id', () => {
        const result = shapeOf({ materialCategories: [{ name: 'Metals', description: '' }] });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('materialCategories[0].id must be a non-empty string');
      });
    });

    describe('one checker over a spec table (CR-22)', () => {
      const shapeOf = (overrides: Record<string, unknown>) =>
        validateConfigurationShape({ ...validConfig, ...overrides });

      it('rejects a null entry in every collection, not just the ones somebody remembered', () => {
        // The generic walk is what makes this list complete rather than a list of the entities
        // that happened to get a hand-written checker
        const collections = [
          'stats',
          'skills',
          'materials',
          'materialCategories',
          'items',
          'equipmentSlots',
          'races',
          'currencyTiers',
          'archetypes',
          'constants',
          'curves',
          'diceLadders',
          'rollDefinitions',
        ];

        for (const field of collections) {
          const result = shapeOf({ [field]: [null] });

          expect(result.isValid, field).toBe(false);
          expect(result.errors, field).toContain(`${field}[0] must be an object`);
        }
      });

      it('reports a present-but-not-an-array optional collection as such', () => {
        for (const field of [
          'archetypes',
          'constants',
          'curves',
          'diceLadders',
          'rollDefinitions',
        ]) {
          const result = shapeOf({ [field]: 'nope' });

          expect(result.errors, field).toContain(`Field '${field}' must be an array when present`);
        }
      });

      it('reports a required collection as missing exactly once', () => {
        const { stats: _dropped, ...withoutStats } = validConfig;

        const result = validateConfigurationShape(withoutStats);

        expect(result.errors.filter((error) => error.includes("'stats'"))).toEqual([
          "Field 'stats' must be an array",
        ]);
      });
    });

    describe('material tiers beyond their bonuses (CR-03)', () => {
      const withMaterial = (material: unknown) =>
        validateConfigurationShape({ ...validConfig, materials: [material] });

      it('rejects a material with no category, which the engine dereferences', () => {
        const result = withMaterial({ id: 'iron', name: 'Iron', description: '', levels: [] });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('materials[0].categoryId must be a material category id');
      });

      it('rejects a tier with no value, which used to crash the engine validator', () => {
        // `level.value.tierId` is read unguarded in `engine/validator.ts`
        const result = withMaterial({
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'cat1',
          levels: [{ level: 1, name: 'Iron', bonuses: [] }],
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'materials[0].levels[0].value must be a { tierId, amount } object'
        );
      });

      it('rejects a tier whose value names no currency tier', () => {
        const result = withMaterial({
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'cat1',
          levels: [{ level: 1, name: 'Iron', bonuses: [], value: { amount: 10 } }],
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'materials[0].levels[0].value.tierId must be a currency tier id'
        );
      });
    });

    it('should reject non-object data', () => {
      const result = validateConfigurationShape('not an object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should reject null data', () => {
      const result = validateConfigurationShape(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should validate required string fields', () => {
      const invalid = { ...validConfig, name: 123 };
      const result = validateConfigurationShape(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    it('should validate required array fields', () => {
      const invalid = { ...validConfig, stats: 'not an array' };
      const result = validateConfigurationShape(invalid);

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
      const result = validateConfigurationShape(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('abbreviation'))).toBe(true);
      expect(result.errors.some((e) => e.includes('rounding'))).toBe(true);
    });

    it('should accept a stat with no formula — that is what makes it invested', () => {
      const result = validateConfigurationShape(validConfig);

      expect(result.isValid).toBe(true);
    });

    it('should validate skill structure (TICKET-SKL-02)', () => {
      // A file still holding v1's `{ code, bonusFormula }` is reported by name rather than
      // importing as a skill derived from nothing
      const invalid = {
        ...validConfig,
        skills: [{ code: 'AB', name: 'Invalid', bonusFormula: 'STR' }],
      };
      const result = validateConfigurationShape(invalid);

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
      const result = validateConfigurationShape(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('skills[0].statWeights[0].statId must be a stat id');
      expect(result.errors).toContain('skills[0].statWeights[0].weight must be a finite number');
    });

    it('should refuse a file still carrying combatSkills (TICKET-ROLL-06)', () => {
      // Retired, so **refused rather than ignored** — a file authored against the old shape plays
      // differently from the one this build would import, and the message names the replacement
      const result = validateConfigurationShape({ ...validConfig, combatSkills: [] });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('rollDefinitions');
    });

    it('should collect multiple errors', () => {
      const invalid = {
        ...validConfig,
        name: 123,
        stats: 'not an array',
        mainSkills: 'not an array',
      };
      const result = validateConfigurationShape(invalid);

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
      const invalid = { ...validConfig, name: 123, stats: 'invalid' };
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
      materials: [],
      materialCategories: [],
      items: [],
      equipmentSlots: [],
      races: [],
      currencyTiers: [],
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
      const exported = serializeConfiguration(validConfig);

      expect(JSON.parse(exported).schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
      expect(importConfiguration(exported)).toEqual(validConfig);
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

  describe('material stat modifier round-trip (TICKET-MAT-01)', () => {
    const roundTrip = async (config: Configuration): Promise<Configuration> =>
      importConfiguration(serializeConfiguration(config));

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

      const raw = JSON.parse(serializeConfiguration(config));

      expect(raw.materials[0].levels[0].bonuses).toEqual([{ statId: 'id-str', modifier: 50 }]);
    });

    it('should reject a tier bonus that is not { statId, modifier }', () => {
      const oldShape = JSON.stringify(withMaterials([{ skillCode: 'STR', modifier: 2 }]));
      const badNumber = JSON.stringify(withMaterials([{ statId: 'id-str', modifier: 'a lot' }]));

      expect(() => importConfiguration(oldShape)).toThrow(ValidationError);
      expect(() => importConfiguration(badNumber)).toThrow(ValidationError);
    });
  });

  describe('roll definitions (TICKET-ROLL-05)', () => {
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

  describe('archetypes (TICKET-ARC-01)', () => {
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

  describe('retired fields (TICKET-RES-02)', () => {
    it('should reject a file still carrying mainSkillPointBudget rather than ignoring it', () => {
      const withRetiredField = { ...validConfig, mainSkillPointBudget: 25 };

      const result = validateConfigurationShape(withRetiredField);

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('mainSkillPointBudget');
      expect(() => importConfiguration(JSON.stringify(withRetiredField))).toThrow(ValidationError);
    });

    it('should name what replaced the field, not just refuse it', () => {
      const withRetiredField = { ...validConfig, mainSkillPointBudget: 25 };

      expect(validateConfigurationShape(withRetiredField).errors.join(' ')).toContain(
        'points_per_level'
      );
    });

    it('should reject a retired field whatever its value, including zero', () => {
      // The old shape allowed 0 ("no points"), so a file holding it is exactly as stale as one
      // holding 25 — a falsy value must not slip through the presence check
      expect(validateConfigurationShape({ ...validConfig, mainSkillPointBudget: 0 }).isValid).toBe(
        false
      );
    });

    it('should accept a file on the current shape, which carries no such field', () => {
      expect(validateConfigurationShape(validConfig).isValid).toBe(true);
      expect('mainSkillPointBudget' in validConfig).toBe(false);
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
      const exported = serializeConfiguration(config);

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
      const exported = serializeConfiguration(config);

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
        curves: [
          { ...sound, columns: [{ ...sound.columns[0], generator: 'key * const.xp_step' }] },
        ],
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
});
