/**
 * Import/Export Service Tests — the pure half, and the service's own contract
 *
 * Serialising, parsing, version gating and the generic shape gate. The `Blob`, download-anchor and
 * `File` behaviour moved to `client/services/configFiles.test.ts` when TICKET-DX-07 split the
 * service along the browser-API seam; both halves are written against the same fixture
 * (`importExport.fixtures.ts`) so neither can drift.
 *
 * ## The per-entity blocks live in sibling files (TICKET-SPL-01)
 *
 * This file was 1,522 lines and sixteen `describe`s, growing one per-entity block per shape ticket
 * and deleting nothing, and [TEST_STATUS.md](../../../TEST_STATUS.md)'s hotspot row had named the
 * trigger for three tickets running: **the sixth per-entity describe splits the file**, per entity,
 * the way `ENTITY_SPECS` is a table. Spells are the sixth, so the split happened here.
 *
 * The rule the split follows, stated so the next entity knows where to land:
 *
 * - **A whole `describe` moves, never a loose `it`.** What is left below is the service's own
 *   contract — the required fields, the two exhaustive collection tables, `importConfiguration`, the
 *   version gate, and the *configuration-level* retired fields — plus the handful of stat and skill
 *   cases that sit loose in `validateConfigurationShape`'s own list. Moving individual cases would
 *   turn a mechanical split into an editorial one.
 * - **One file per entity**, named `importExport.<collection>.test.ts`: `stats`, `races`,
 *   `materials`, `inlays`, `spells`, `items`, `equipment`, `rolls`, `archetypes`, `constants`,
 *   `curves`. A new `ENTITY_SPECS` row gets a new file rather than a new block here.
 * - **A field retired from an *entity* goes with that entity**, not with the configuration-level
 *   retirements below: the sentence names the entity's path and the fixture is one of its entries.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
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
          'inlays',
          'spells',
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
          'inlays',
          'spells',
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
});
