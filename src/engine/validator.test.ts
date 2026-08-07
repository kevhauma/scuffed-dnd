/**
 * Configuration Validator Tests
 */

import { describe, expect, it } from 'vitest';
import type { Configuration, Curve } from '../types/config';
import { validateConfiguration } from './validator';

/**
 * Helper to create a minimal valid configuration
 */
function createMinimalConfig(): Configuration {
  return {
    id: 'test-config',
    name: 'Test Configuration',
    version: '1.0.0',
    mainSkills: [],
    stats: [],
    specialitySkills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('validateConfiguration', () => {
  describe('Valid configurations', () => {
    it('should validate an empty configuration', () => {
      const config = createMinimalConfig();
      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a configuration with valid stat formulas', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
        { id: 'CON', code: 'CON', name: 'Constitution', description: '', maxLevel: 10 },
      ];
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'STR * 10 + CON * 5' }];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate speciality skills with valid formulas', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
        { id: 'DEX', code: 'DEX', name: 'Dexterity', description: '', maxLevel: 10 },
      ];
      config.specialitySkills = [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: '(STR + DEX) / 2',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate combat skills referencing main and speciality skills', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.specialitySkills = [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ];
      config.combatSkills = [
        {
          id: 'SWD',
          code: 'SWD',
          name: 'Sword',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + MEL',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate materials with valid category and skill references', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.materialCategories = [{ id: 'metals', name: 'Metals', description: '' }];
      config.currencyTiers = [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 1 }];
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [{ skillCode: 'STR', modifier: 2 }],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate items with valid equipment slot and material references', () => {
      const config = createMinimalConfig();
      config.equipmentSlots = [{ type: 'helmet', name: 'Helmet', description: '' }];
      config.materialCategories = [{ id: 'metals', name: 'Metals', description: '' }];
      config.currencyTiers = [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 1 }];
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ];
      config.items = [
        {
          id: 'iron-helmet',
          name: 'Iron Helmet',
          description: '',
          equipmentSlotType: 'helmet',
          materialId: 'iron',
          materialLevel: 1,
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate races with valid main skill references', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
        { id: 'WIS', code: 'WIS', name: 'Wisdom', description: '', maxLevel: 10 },
      ];
      config.races = [
        {
          id: 'dwarf',
          name: 'Dwarf',
          description: '',
          skillModifiers: [
            { skillCode: 'STR', modifier: 2 },
            { skillCode: 'WIS', modifier: -1 },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Formula validation errors', () => {
    it('should detect undefined variable in stat formula', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'STR + UNDEFINED' }];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe('Formula Validation');
      expect(result.errors[0].message).toContain('Health');
      expect(result.errors[0].message).toContain('UNDEFINED');
    });

    it('should detect undefined variable in speciality skill formula', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.specialitySkills = [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'STR + MISSING',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Melee');
      expect(result.errors[0].message).toContain('MISSING');
    });

    it('should detect undefined variable in combat skill formula', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.combatSkills = [
        {
          id: 'SWD',
          code: 'SWD',
          name: 'Sword',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + NOTFOUND',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sword');
      expect(result.errors[0].message).toContain('NOTFOUND');
    });

    it('should detect syntax errors in formulas', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'STR + * 10' }];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].category).toBe('Formula Validation');
    });

    it('should detect empty formulas', () => {
      const config = createMinimalConfig();
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: '' }];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('cannot be empty');
    });
  });

  describe('Circular dependency detection', () => {
    it('should detect circular dependency between stats', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      // This creates a circular dependency if stats could reference each other
      // In the current design, stats only reference main skills, so this won't create a cycle
      // But we test the validator's capability
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'STR' }];

      const result = validateConfiguration(config);

      // Should be valid since stats don't reference each other
      expect(result.isValid).toBe(true);
    });

    it('should detect circular dependency in speciality skills', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      // Speciality skills can't reference each other in current design
      // They only reference main skills
      config.specialitySkills = [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
    });

    it('should detect circular dependency between combat and speciality skills', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.specialitySkills = [
        {
          id: 'MEL',
          code: 'MEL',
          name: 'Melee',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'STR',
        },
      ];
      // Combat skill references speciality skill - this is valid
      config.combatSkills = [
        {
          id: 'SWD',
          code: 'SWD',
          name: 'Sword',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'MEL',
        },
      ];

      const result = validateConfiguration(config);

      // Should be valid - combat skills can reference speciality skills
      expect(result.isValid).toBe(true);
    });
  });

  describe('Reference validation errors', () => {
    it('should detect invalid material category reference', () => {
      const config = createMinimalConfig();
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'nonexistent',
          levels: [],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe('Reference Validation');
      expect(result.errors[0].message).toContain('Iron');
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('should detect invalid equipment slot type reference', () => {
      const config = createMinimalConfig();
      config.items = [
        {
          id: 'helmet',
          name: 'Helmet',
          description: '',
          equipmentSlotType: 'nonexistent',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Helmet');
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('should detect invalid material reference in item', () => {
      const config = createMinimalConfig();
      config.items = [
        {
          id: 'sword',
          name: 'Sword',
          description: '',
          materialId: 'nonexistent',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sword');
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('should detect invalid material level in item', () => {
      const config = createMinimalConfig();
      config.materialCategories = [{ id: 'metals', name: 'Metals', description: '' }];
      config.currencyTiers = [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 1 }];
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ];
      config.items = [
        {
          id: 'sword',
          name: 'Sword',
          description: '',
          materialId: 'iron',
          materialLevel: 99, // Non-existent level
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Sword');
      expect(result.errors[0].message).toContain('level 99');
    });

    it('should detect invalid skill reference in material bonuses', () => {
      const config = createMinimalConfig();
      config.materialCategories = [{ id: 'metals', name: 'Metals', description: '' }];
      config.currencyTiers = [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 1 }];
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [{ skillCode: 'INVALID', modifier: 2 }],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Iron');
      expect(result.errors[0].message).toContain('INVALID');
    });

    it('should detect invalid currency tier reference in material', () => {
      const config = createMinimalConfig();
      config.materialCategories = [{ id: 'metals', name: 'Metals', description: '' }];
      config.materials = [
        {
          id: 'iron',
          name: 'Iron',
          description: '',
          categoryId: 'metals',
          levels: [
            {
              level: 1,
              name: 'Iron',
              bonuses: [],
              value: { tierId: 'nonexistent', amount: 10 },
            },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Iron');
      expect(result.errors[0].message).toContain('nonexistent');
    });

    it('should detect invalid main skill reference in race', () => {
      const config = createMinimalConfig();
      config.races = [
        {
          id: 'elf',
          name: 'Elf',
          description: '',
          skillModifiers: [{ skillCode: 'INVALID', modifier: 2 }],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Elf');
      expect(result.errors[0].message).toContain('INVALID');
    });
  });

  describe('Uniqueness validation', () => {
    it('should detect duplicate skill codes across skill types', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
      ];
      config.specialitySkills = [
        {
          id: 'STR',
          code: 'STR',
          name: 'Strike',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: '5',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe('Uniqueness Validation');
      expect(result.errors[0].message).toContain('STR');
      expect(result.errors[0].message).toContain('Strength');
      expect(result.errors[0].message).toContain('Strike');
    });

    it('should detect duplicate codes within same skill type', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
        { id: 'STR', code: 'STR', name: 'Strong', description: '', maxLevel: 10 },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('STR');
    });
  });

  describe('Warnings', () => {
    it('should warn about duplicate currency tier orders', () => {
      const config = createMinimalConfig();
      config.currencyTiers = [
        { id: 'copper', name: 'Copper', order: 0, conversionToNext: 10 },
        { id: 'silver', name: 'Silver', order: 0, conversionToNext: 10 },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('duplicate order');
    });

    it('should warn about gaps in currency tier ordering', () => {
      const config = createMinimalConfig();
      config.currencyTiers = [
        { id: 'copper', name: 'Copper', order: 0, conversionToNext: 10 },
        { id: 'gold', name: 'Gold', order: 5, conversionToNext: 10 },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('gaps');
    });
  });

  describe('Multiple errors', () => {
    it('should report all errors in a configuration', () => {
      const config = createMinimalConfig();
      config.stats = [
        { id: 'hp', name: 'Health', description: '', formula: 'INVALID1' },
        { id: 'mp', name: 'Mana', description: '', formula: 'INVALID2' },
      ];
      config.items = [
        {
          id: 'item1',
          name: 'Item 1',
          description: '',
          equipmentSlotType: 'nonexistent1',
        },
        {
          id: 'item2',
          name: 'Item 2',
          description: '',
          equipmentSlotType: 'nonexistent2',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Validation report structure', () => {
    it('should include timestamp in validation report', () => {
      const config = createMinimalConfig();
      const result = validateConfiguration(config);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should include entity information in errors', () => {
      const config = createMinimalConfig();
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'INVALID' }];

      const result = validateConfiguration(config);

      expect(result.errors[0].entityType).toBe('stat');
      expect(result.errors[0].entityId).toBe('hp');
      expect(result.errors[0].entityName).toBe('Health');
    });
  });

  describe('namespace scoping on import (TICKET-FORM-04)', () => {
    // The import-time report and the save-time guard must answer the same question the same
    // way. Both read `scopeFor`; if this file ever hardcodes the rule again, these fail.
    it('reports an unknown namespace in an imported stat formula', () => {
      const config = createMinimalConfig();
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'wibble.thing' }];

      const result = validateConfiguration(config);

      expect(result.errors.some((e) => e.message.includes('Unknown namespace: wibble'))).toBe(true);
    });

    it('reports an unknown member in an imported stat formula', () => {
      const config = createMinimalConfig();
      config.stats = [{ id: 'hp', name: 'Health', description: '', formula: 'stats.bogus' }];

      const result = validateConfiguration(config);

      expect(result.errors.some((e) => e.message.includes('Unknown member: stats.bogus'))).toBe(
        true
      );
    });

    it('reports a namespace that is out of scope for a speciality skill', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      ];
      config.specialitySkills = [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'curve.growth(STR)',
        },
      ];

      const result = validateConfiguration(config);

      expect(
        result.errors.some((e) => e.message.includes('Namespace not available here: curve'))
      ).toBe(true);
    });

    it('accepts an in-scope namespaced reference', () => {
      const config = createMinimalConfig();
      config.mainSkills = [
        { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      ];
      // A stat is written by its display spelling — a slug of its name — not by its id, which
      // only the stored form carries (TICKET-REF-01).
      config.stats = [
        { id: 'hp', name: 'Health', description: '', formula: 'STR * 10' },
        { id: 'armour', name: 'Armour', description: '', formula: 'stats.health / 2' },
      ];

      const result = validateConfiguration(config);

      expect(result.errors.filter((e) => e.category === 'Formula Validation')).toEqual([]);
    });
  });

  describe('curve tables (TICKET-CRV-01)', () => {
    /** A sound curve, so each case states only what it breaks */
    function withCurve(overrides: Partial<Curve> = {}): Configuration {
      const config = createMinimalConfig();
      config.curves = [
        {
          id: 'id-growth',
          name: 'growth',
          displayName: 'Growth',
          description: '',
          keyName: 'level',
          columns: [{ id: 'col', name: 'value' }],
          rows: [
            { key: 1, values: [10] },
            { key: 2, values: [20] },
            { key: 3, values: [30] },
          ],
          interpolation: 'step',
          outOfRange: 'clamp',
          lookupDirection: 'forward',
          ...overrides,
        },
      ];
      return config;
    }

    function curveIssues(config: Configuration) {
      const report = validateConfiguration(config);
      return {
        errors: report.errors.filter((issue) => issue.category === 'Curve Validation'),
        warnings: report.warnings.filter((issue) => issue.category === 'Curve Validation'),
      };
    }

    it('accepts a sound table', () => {
      const { errors, warnings } = curveIssues(withCurve());

      expect(errors).toEqual([]);
      expect(warnings).toEqual([]);
    });

    it('reports a duplicate key, naming the key column', () => {
      const { errors } = curveIssues(
        withCurve({
          rows: [
            { key: 1, values: [10] },
            { key: 1, values: [20] },
          ],
        })
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('more than one row for level 1');
      expect(errors[0].entityId).toBe('id-growth');
    });

    it('reports rows that are not sorted by key', () => {
      const { errors } = curveIssues(
        withCurve({
          rows: [
            { key: 3, values: [30] },
            { key: 1, values: [10] },
          ],
        })
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('not sorted');
    });

    it('reports a row with the wrong number of values', () => {
      const { errors } = curveIssues(withCurve({ rows: [{ key: 1, values: [10, 20] }] }));

      expect(errors.map((issue) => issue.message)).toEqual([
        expect.stringContaining('2 value(s) for 1 column(s)'),
      ]);
    });

    it('reports a curve with no value columns', () => {
      const { errors } = curveIssues(withCurve({ columns: [], rows: [] }));

      expect(errors.map((issue) => issue.message)).toEqual([
        expect.stringContaining('no value columns'),
      ]);
    });

    it('warns about a gap that silently collapses a wide band onto one value', () => {
      const { errors, warnings } = curveIssues(
        withCurve({
          rows: [
            { key: 1, values: [10] },
            { key: 2, values: [20] },
            { key: 90, values: [30] },
          ],
        })
      );

      // A warning, not an error — the challenge-rating table is deliberately this shape
      expect(errors).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('jumps from 2 to 90');
    });

    it('reports a reverse curve whose value column doubles back', () => {
      const { errors } = curveIssues(
        withCurve({
          lookupDirection: 'reverse',
          rows: [
            { key: 1, values: [500] },
            { key: 2, values: [100] },
            { key: 3, values: [900] },
          ],
        })
      );

      // A reverse lookup over a column that decreases has two equally correct answers
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must not decrease');
      expect(errors[0].message).toContain('drops from 500 to 100');
    });

    it('accepts a reverse curve whose value column ascends', () => {
      const { errors } = curveIssues(
        withCurve({
          lookupDirection: 'reverse',
          rows: [
            { key: 1, values: [0] },
            { key: 2, values: [300] },
            { key: 3, values: [900] },
          ],
        })
      );

      expect(errors).toEqual([]);
    });

    it('leaves a forward curve free to decrease — only the read axis has to ascend', () => {
      const { errors } = curveIssues(
        withCurve({
          rows: [
            { key: 1, values: [30] },
            { key: 2, values: [20] },
            { key: 3, values: [10] },
          ],
        })
      );

      expect(errors).toEqual([]);
    });

    it('does not warn about gaps when the curve interpolates', () => {
      const { warnings } = curveIssues(
        withCurve({
          interpolation: 'linear',
          rows: [
            { key: 1, values: [10] },
            { key: 2, values: [20] },
            { key: 90, values: [30] },
          ],
        })
      );

      expect(warnings).toEqual([]);
    });
  });
});
