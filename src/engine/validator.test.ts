/**
 * Configuration Validator Tests
 */

import { describe, expect, it } from 'vitest';
import type { Configuration, Curve } from '../types/config';
import { validateConfiguration } from './validator';

/** A stat with the boring fields filled in */
function stat(id: string, name: string, abbreviation: string, formula?: string) {
  return {
    id,
    name,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none' as const,
    ...(formula ? { formula } : {}),
  };
}

/**
 * Helper to create a minimal valid configuration
 *
 * It carries the three invested stats the formula fixtures below name (TICKET-STAT-01 merged
 * `MainSkill` into `Stat`, so the codes a formula spells now come from here).
 */
function createMinimalConfig(): Configuration {
  return {
    id: 'test-config',
    name: 'Test Configuration',
    version: '1.0.0',
    schemaVersion: 5,
    stats: [
      stat('STR', 'Strength', 'STR'),
      stat('DEX', 'Dexterity', 'DEX'),
      stat('CON', 'Constitution', 'CON'),
    ],
    skills: [],
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
      config.stats = [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'CON',
          name: 'Constitution',
          abbreviation: 'CON',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'STR * 10 + CON * 5',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate skills whose weights name real stats (TICKET-SKL-02)', () => {
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [
            { statId: 'STR', weight: 0.2 },
            { statId: 'DEX', weight: 0.1 },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate combat skills referencing stats and skills', () => {
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [{ statId: 'STR', weight: 0.2 }],
        },
      ];
      config.combatSkills = [
        {
          id: 'SWD',
          code: 'SWD',
          name: 'Sword',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'STR + skills.melee',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate materials with valid category and stat references', () => {
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
              bonuses: [{ statId: 'STR', modifier: 2 }],
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

    it('should validate races with valid stat references', () => {
      const config = createMinimalConfig();
      config.stats = [...config.stats, stat('WIS', 'Wisdom', 'WIS')];
      config.races = [
        {
          id: 'dwarf',
          name: 'Dwarf',
          description: '',
          statValues: { STR: 2, WIS: -1 },
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
      config.stats = [...config.stats, stat('hp', 'Health', 'HEA', 'STR + UNDEFINED')];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].category).toBe('Formula Validation');
      expect(result.errors[0].message).toContain('Health');
      expect(result.errors[0].message).toContain('UNDEFINED');
    });

    it('should detect a weight naming a stat the ruleset does not define (TICKET-SKL-02)', () => {
      // A skill has no formula to hold an undefined variable — what can be wrong is a weight row
      // pointing at a stat that is gone (Concept 02)
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [
            { statId: 'STR', weight: 0.2 },
            { statId: 'MISSING', weight: 0.1 },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Melee');
      expect(result.errors[0].message).toContain('MISSING');
    });

    it('should warn about a skill with no weights at all, without refusing it', () => {
      // Concept 02's own rule: always level 0 unless the Player invests — worth saying, not an error
      const config = createMinimalConfig();
      config.skills = [{ id: 'MEL', name: 'Melee', description: '', statWeights: [] }];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some((w) => w.message.includes('no stat weights'))).toBe(true);
    });

    it('should detect undefined variable in combat skill formula', () => {
      const config = createMinimalConfig();
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
      config.stats = [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'STR + * 10',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].category).toBe('Formula Validation');
    });

    it('should detect empty formulas', () => {
      const config = createMinimalConfig();
      config.stats = [
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: '',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('cannot be empty');
    });
  });

  describe('Circular dependency detection', () => {
    it('should detect circular dependency between stats', () => {
      const config = createMinimalConfig();
      // This creates a circular dependency if stats could reference each other
      // In the current design, stats only reference main skills, so this won't create a cycle
      // But we test the validator's capability
      config.stats = [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'STR',
        },
      ];

      const result = validateConfiguration(config);

      // Should be valid since stats don't reference each other
      expect(result.isValid).toBe(true);
    });

    it('cannot build a cycle through a skill, which holds no formula (TICKET-SKL-02)', () => {
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [{ statId: 'STR', weight: 0.2 }],
        },
      ];
      // A combat skill reading a skill is a chain, not a cycle: the skill's weights point at
      // stats and nothing points back
      config.combatSkills = [
        {
          id: 'SWD',
          code: 'SWD',
          name: 'Sword',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
          bonusFormula: 'skills.melee',
        },
      ];

      const result = validateConfiguration(config);

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

    it('should detect a dangling stat reference in material bonuses (TICKET-MAT-01)', () => {
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
              bonuses: [{ statId: 'INVALID', modifier: 2 }],
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

    it('should refuse a material bonus that targets a derived stat (TICKET-MAT-01)', () => {
      // A derived stat's formula is its only source, so a modifier there would be a term the
      // composition never applies — silently, which is the worst kind of wrong number
      const config = createMinimalConfig();
      config.stats = [
        ...config.stats,
        {
          id: 'apt',
          name: 'APT',
          abbreviation: 'APT',
          description: '',
          order: 9,
          countsTowardTotal: false,
          isResource: false,
          rounding: 'none',
          formula: 'STR / 2',
        },
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
              bonuses: [{ statId: 'apt', modifier: 2 }],
              value: { tierId: 'gold', amount: 10 },
            },
          ],
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('APT');
      expect(result.errors[0].message).toContain('derived stat');
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

    it('should detect a race stat block naming a stat id the ruleset does not define', () => {
      const config = createMinimalConfig();
      config.races = [
        {
          id: 'elf',
          name: 'Elf',
          description: '',
          statValues: { INVALID: 2 },
        },
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Elf');
      expect(result.errors[0].message).toContain('INVALID');
    });

    it('should accept a race stat block that names only some of the stats', () => {
      // The absent-reads-0 rule is not a validation hole: saying nothing about a stat is a valid
      // block, and only a key naming a *non-existent* stat is an error (TICKET-RACE-01)
      const config = createMinimalConfig();
      config.races = [{ id: 'elf', name: 'Elf', description: '', statValues: {} }];

      expect(validateConfiguration(config).errors).toEqual([]);
    });
  });

  describe('Uniqueness validation', () => {
    it('should detect a combat code colliding with a stat abbreviation', () => {
      // The flat space holds stat abbreviations and combat codes since TICKET-SKL-02 — a `Skill`
      // has no code, so it cannot collide with anything
      const config = createMinimalConfig();
      config.combatSkills = [
        {
          id: 'strike',
          code: 'STR',
          name: 'Strike',
          description: '',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
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

    it('lets two skills share a name-shaped spelling without colliding on a code', () => {
      // The sheet genuinely has `skinning` and `Skinning` (Concept 02's import note). They slug
      // the same way, but neither occupies the flat space, so uniqueness has nothing to refuse.
      const config = createMinimalConfig();
      config.skills = [
        { id: 'a', name: 'skinning', description: '', statWeights: [] },
        { id: 'b', name: 'Skinning', description: '', statWeights: [] },
      ];

      expect(validateConfiguration(config).errors).toEqual([]);
    });

    it('should detect two stats sharing one abbreviation', () => {
      const config = createMinimalConfig();
      config.stats = [...config.stats, stat('str2', 'Strong', 'STR')];

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

  /**
   * Concept 02's three rules, each at the severity the page asks for. The severities are the point
   * of the group: a ruleset that reports everything as a warning teaches the User to skip warnings.
   */
  describe('skill validation (Concept 02, TICKET-SKL-03)', () => {
    function skill(id: string, name: string, statWeights: { statId: string; weight: number }[]) {
      return { id, name, description: '', statWeights };
    }

    it('should warn that a skill with no weights is worth only what the Player invests', () => {
      const config = createMinimalConfig();
      config.skills = [skill('s1', 'Meditation', [])];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        severity: 'warning',
        entityType: 'skill',
        entityId: 's1',
      });
      expect(result.warnings[0].message).toContain('no stat weights');
    });

    it('should report a weight sum above 0.5 as information, not as a problem', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Overweighted', [
          { statId: 'STR', weight: 0.5 },
          { statId: 'DEX', weight: 0.4 },
        ]),
      ];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.information).toHaveLength(1);
      expect(result.information[0]).toMatchObject({
        severity: 'information',
        category: 'Balance',
        entityId: 's1',
      });
      expect(result.information[0].message).toContain('0.9');
    });

    it('should leave a skill weighted the way the sheet weighs its own alone', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Cooking', [
          { statId: 'STR', weight: 0.2 },
          { statId: 'DEX', weight: 0.1 },
        ]),
        skill('s2', 'Hiding', [{ statId: 'DEX', weight: 0.3 }]),
        // Exactly at the boundary — 0.5 is the top of the observed range, not past it
        skill('s3', 'Edge', [{ statId: 'STR', weight: 0.5 }]),
      ];

      const result = validateConfiguration(config);

      expect(result.information).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should state a weight sum without floating-point noise', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Noisy', [
          { statId: 'STR', weight: 0.6 },
          { statId: 'DEX', weight: 0.1 },
        ]),
      ];

      const result = validateConfiguration(config);

      // 0.6 + 0.1 is 0.7000000000000001 in binary floating point
      expect(result.information[0].message).toContain('0.7');
      expect(result.information[0].message).not.toContain('0.7000');
    });

    it('should warn about names that differ only by case, naming both', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'skinning', [{ statId: 'STR', weight: 0.2 }]),
        skill('s2', 'Skinning', [{ statId: 'DEX', weight: 0.2 }]),
      ];

      const result = validateConfiguration(config);

      // Never an error: the sheet genuinely holds both, and a skill left the flat formula space in
      // TICKET-SKL-02, so two skills sharing a spelling collide with nothing
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('warning');
      expect(result.warnings[0].message).toContain('"skinning"');
      expect(result.warnings[0].message).toContain('"Skinning"');
    });

    it('should treat surrounding whitespace as a near-duplicate too', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Charm', [{ statId: 'STR', weight: 0.2 }]),
        skill('s2', ' Charm ', [{ statId: 'DEX', weight: 0.2 }]),
      ];

      const result = validateConfiguration(config);

      expect(result.warnings).toHaveLength(1);
    });

    it('should raise one warning per colliding group rather than one per skill', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Charm', [{ statId: 'STR', weight: 0.2 }]),
        skill('s2', 'charm', [{ statId: 'STR', weight: 0.2 }]),
        skill('s3', 'CHARM', [{ statId: 'STR', weight: 0.2 }]),
      ];

      const result = validateConfiguration(config);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('"CHARM"');
    });

    it('should not flag skills whose names merely resemble one another', () => {
      const config = createMinimalConfig();
      config.skills = [
        skill('s1', 'Cooking', [{ statId: 'STR', weight: 0.2 }]),
        skill('s2', 'Cooling', [{ statId: 'STR', weight: 0.2 }]),
      ];

      const result = validateConfiguration(config);

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Multiple errors', () => {
    it('should report all errors in a configuration', () => {
      const config = createMinimalConfig();
      config.stats = [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strong',
          abbreviation: 'STR',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'INVALID1',
        },
        {
          id: 'mp',
          name: 'Mana',
          abbreviation: 'MAN',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'INVALID2',
        },
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
      config.stats = [
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'INVALID',
        },
      ];

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
      config.stats = [
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'wibble.thing',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.errors.some((e) => e.message.includes('Unknown namespace: wibble'))).toBe(true);
    });

    it('reports an unknown member in an imported stat formula', () => {
      const config = createMinimalConfig();
      config.stats = [
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'stats.bogus',
        },
      ];

      const result = validateConfiguration(config);

      expect(result.errors.some((e) => e.message.includes('Unknown member: stats.bogus'))).toBe(
        true
      );
    });

    it('reports a namespace that is out of scope for a curve generator', () => {
      // The narrowest row of the scope table now that the speciality attachment point is gone
      // (TICKET-SKL-02): a generator fills a table, so it sees `const` and its row key, not stats
      const config = createMinimalConfig();
      config.curves = [
        {
          id: 'id-xp',
          name: 'xp_thresholds',
          displayName: 'XP thresholds',
          description: '',
          keyName: 'level',
          columns: [{ id: 'col', name: 'xp_required', generator: 'stats.strength * key' }],
          rows: [{ key: 1, values: [0] }],
          interpolation: 'step',
          outOfRange: 'error',
          lookupDirection: 'reverse',
        },
      ];

      const result = validateConfiguration(config);

      expect(
        result.errors.some((e) => e.message.includes('Namespace not available here: stats'))
      ).toBe(true);
    });

    it('accepts an in-scope namespaced reference', () => {
      const config = createMinimalConfig();
      // A stat is written by its display spelling — a slug of its name — not by its id, which
      // only the stored form carries (TICKET-REF-01).
      config.stats = [
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'STR',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'STR * 10',
        },
        {
          id: 'armour',
          name: 'Armour',
          abbreviation: 'ARM',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'stats.health / 2',
        },
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

    it('reports a generator formula that would not produce a number (TICKET-CRV-02)', () => {
      const { errors } = curveIssues(
        withCurve({ columns: [{ id: 'col', name: 'value', generator: 'const.nope * key' }] })
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('column "value" generator');
      expect(errors[0].message).toContain('const.nope');
    });

    it('accepts a generator naming the row key and a configured constant', () => {
      const config = withCurve({
        columns: [{ id: 'col', name: 'value', generator: 'const.step * (key + 1)' }],
      });
      config.constants = [
        {
          id: 'id-step',
          name: 'step',
          displayName: 'Step',
          description: 'Growth per level',
          value: 5,
        },
      ];

      expect(curveIssues(config).errors).toEqual([]);
    });

    it('refuses a generator reaching for a skill code, which a table cannot see', () => {
      const config = withCurve({
        columns: [{ id: 'col', name: 'value', generator: 'STR * 2' }],
      });
      expect(curveIssues(config).errors[0].message).toContain('Undefined variable: STR');
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
