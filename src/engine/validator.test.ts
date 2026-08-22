/**
 * Configuration Validator Tests
 */

import { describe, expect, it } from 'vitest';
import type { Configuration, Curve, DiceLadder } from '../types/config';
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
    schemaVersion: 9,
    stats: [
      stat('STR', 'Strength', 'STR'),
      stat('DEX', 'Dexterity', 'DEX'),
      stat('CON', 'Constitution', 'CON'),
    ],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
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

    it('should validate a roll input referencing stats and skills (TICKET-ROLL-06)', () => {
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [{ statId: 'STR', weight: 0.2 }],
        },
      ];
      config.diceLadders = [
        {
          id: 'ladder',
          name: 'Standard',
          description: '',
          dieSizes: [20, 12, 6],
          showZeroTerms: true,
          remainder: 'flat',
        },
      ];
      config.rollDefinitions = [
        {
          id: 'SWD',
          name: 'Sword',
          description: '',
          input: 'STR + skills.melee',
          ladderId: 'ladder',
          order: 0,
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

    it('should detect undefined variable in a roll input (TICKET-ROLL-06)', () => {
      const config = createMinimalConfig();
      config.diceLadders = [
        {
          id: 'ladder',
          name: 'Standard',
          description: '',
          dieSizes: [20, 12, 6],
          showZeroTerms: true,
          remainder: 'flat',
        },
      ];
      config.rollDefinitions = [
        {
          id: 'SWD',
          name: 'Sword',
          description: '',
          input: 'STR + NOTFOUND',
          ladderId: 'ladder',
          order: 0,
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

    it('should name what a duplicate abbreviation actually is (CR-38)', () => {
      const config = createMinimalConfig();
      config.stats = [stat('str', 'Strength', 'STR'), stat('stm', 'Stamina', 'STR')];

      const result = validateConfiguration(config);
      const duplicate = result.errors.find((error) => error.message.includes('STR'));

      // Skill codes retired in TICKET-SKL-02; this check reads stats and must say so
      expect(duplicate?.message).toBe(
        'Duplicate stat abbreviation "STR" used by: Stat "Strength", Stat "Stamina"'
      );
      expect(duplicate?.category).toBe('Uniqueness Validation');
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
      // A skill's weights point at stats and nothing points back, so `skills.*` is a leaf in the
      // graph. Read from a derived stat that names one of those stats — a stat may not name a
      // skill at all since CR-02, because it is computed before any skill has a value.
      config.stats = [...config.stats, stat('agility', 'Agility', 'AGI', 'STR * 2')];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(true);
    });

    it('reports a stat formula that names a skill, which it cannot evaluate (CR-02)', () => {
      const config = createMinimalConfig();
      config.skills = [
        {
          id: 'MEL',
          name: 'Melee',
          description: '',
          statWeights: [{ statId: 'STR', weight: 0.2 }],
        },
      ];
      config.stats = [...config.stats, stat('agility', 'Agility', 'AGI', 'skills.melee')];

      const result = validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.map((issue) => issue.message)).toContain(
        'Stat "Agility": Namespace not available here: skills'
      );
    });

    it('reports a cycle in a ruleset whose ids are UUIDs (CR-01)', () => {
      // The shape every saved configuration actually has: ids minted by `crypto.randomUUID()`,
      // formulas in display form. The detector used to key nodes by id and edges by spelling, so
      // this exact ruleset validated clean.
      const alphaId = '7c22b0f1-0000-4000-8000-000000000001';
      const betaId = '7c22b0f1-0000-4000-8000-000000000002';

      const config = createMinimalConfig();
      config.stats = [
        ...config.stats,
        stat(alphaId, 'Alpha', 'ALP', 'stats.beta + 1'),
        stat(betaId, 'Beta', 'BET', 'ALP * 2'),
      ];

      const result = validateConfiguration(config);
      const cycles = result.errors.filter((issue) => issue.category === 'Circular Dependency');

      expect(result.isValid).toBe(false);
      expect(cycles).toHaveLength(1);
      // Named, not id'd — the chain is node ids spelled back out through each node's label
      expect(cycles[0].message).toMatch(
        /Circular dependency detected: (Alpha → Beta → Alpha|Beta → Alpha → Beta)/
      );
    });

    it('leaves an acyclic UUID-keyed ruleset alone (CR-01)', () => {
      const config = createMinimalConfig();
      config.stats = [
        ...config.stats,
        stat('7c22b0f1-0000-4000-8000-000000000003', 'Alpha', 'ALP', 'STR + 1'),
        stat('7c22b0f1-0000-4000-8000-000000000004', 'Beta', 'BET', 'stats.alpha * 2'),
      ];

      const result = validateConfiguration(config);

      expect(result.errors.filter((issue) => issue.category === 'Circular Dependency')).toEqual([]);
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
    it('should detect two stats sharing an abbreviation', () => {
      // The flat space holds **stat abbreviations and nothing else** since TICKET-ROLL-06: a
      // `Skill` left it in SKL-02 and the combat codes went with the entity, so the only collision
      // left to detect is between two stats
      const config = createMinimalConfig();
      config.stats = [...config.stats, stat('strike', 'Strike', 'STR')];

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

  describe('archetypes (TICKET-ARC-01)', () => {
    /** Two stats and a `point_buy` curve with all three affinity columns — the seeded shape */
    function withArchetypes(overrides: Partial<Configuration> = {}): Configuration {
      const config = createMinimalConfig();
      config.stats = [
        {
          id: 'str-id',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'dex-id',
          name: 'Dexterity',
          abbreviation: 'DEX',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
      ];
      config.curves = [
        {
          id: 'id-point-buy',
          name: 'point_buy',
          displayName: 'Point buy',
          description: '',
          keyName: 'points',
          columns: [
            { id: 'col-non', name: 'non' },
            { id: 'col-sub', name: 'sub' },
            { id: 'col-main', name: 'main' },
          ],
          rows: [{ key: 1, values: [1, 1, 1] }],
          interpolation: 'step',
          outOfRange: 'clamp',
          lookupDirection: 'forward',
        },
      ];
      config.archetypes = [
        {
          id: 'strong',
          name: 'Strong',
          description: '',
          statAffinity: { 'str-id': 'main', 'dex-id': 'non' },
        },
      ];
      return { ...config, ...overrides };
    }

    it('should accept an archetype tagging every configured stat', () => {
      const result = validateConfiguration(withArchetypes());

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should warn that an untagged stat defaults to non', () => {
      const config = withArchetypes();
      config.archetypes = [
        { id: 'strong', name: 'Strong', description: '', statAffinity: { 'str-id': 'main' } },
      ];

      const { warnings } = validateConfiguration(config);

      // Concept 03's default is applied either way; the point is that the User is told it was
      expect(warnings.some((issue) => issue.message.includes('does not tag DEX'))).toBe(true);
      expect(warnings.some((issue) => issue.message.includes('defaults to "non"'))).toBe(true);
    });

    it('should name every untagged stat in one warning rather than one each', () => {
      const config = withArchetypes();
      config.archetypes = [{ id: 'blank', name: 'Blank', description: '', statAffinity: {} }];

      const { warnings } = validateConfiguration(config);
      const untagged = warnings.filter((issue) => issue.entityId === 'blank');

      expect(untagged).toHaveLength(1);
      expect(untagged[0].message).toContain('STR, DEX');
      expect(untagged[0].message).toContain('they default');
    });

    it('should report an affinity keyed by a stat the ruleset does not define', () => {
      const config = withArchetypes();
      config.archetypes = [
        {
          id: 'strong',
          name: 'Strong',
          description: '',
          statAffinity: { 'str-id': 'main', 'dex-id': 'sub', 'gone-id': 'main' },
        },
      ];

      const { errors } = validateConfiguration(config);

      expect(
        errors.some((issue) =>
          issue.message.includes('Archetype "Strong" references non-existent stat: gone-id')
        )
      ).toBe(true);
    });

    it('should report a point_buy curve with no column for an affinity in use', () => {
      const config = withArchetypes();
      // The `main` column is gone, so TICKET-ARC-02 has nothing to look a Strong point up in
      const pointBuy = config.curves?.[0];
      if (pointBuy) {
        pointBuy.columns = pointBuy.columns.filter((column) => column.name !== 'main');
        pointBuy.rows = [{ key: 1, values: [1, 1] }];
      }

      const { errors } = validateConfiguration(config);

      expect(errors.some((issue) => issue.message.includes('has no "main" column'))).toBe(true);
    });

    it('should report a missing non column even when no archetype tags anything non', () => {
      const config = withArchetypes();
      config.archetypes = [
        {
          id: 'strong',
          name: 'Strong',
          description: '',
          statAffinity: { 'str-id': 'main', 'dex-id': 'sub' },
        },
      ];
      const pointBuy = config.curves?.[0];
      if (pointBuy) {
        pointBuy.columns = pointBuy.columns.filter((column) => column.name !== 'non');
        pointBuy.rows = [{ key: 1, values: [1, 1] }];
      }

      const { errors } = validateConfiguration(config);

      // `non` is the default for a stat added later, so a ruleset with stats always needs it
      expect(errors.some((issue) => issue.message.includes('has no "non" column'))).toBe(true);
    });

    it('should report a ruleset that has archetypes but no point_buy curve at all', () => {
      // Strictly worse than a missing column, so it cannot be the quiet case
      const config = withArchetypes({ curves: [] });

      const { errors } = validateConfiguration(config);

      expect(errors.some((issue) => issue.message.includes('has no "point_buy" curve'))).toBe(true);
    });

    it('should say nothing about a missing point_buy curve when there are no archetypes', () => {
      const config = withArchetypes({ curves: [], archetypes: [] });

      expect(validateConfiguration(config).errors).toEqual([]);
    });

    it('should say nothing about point_buy columns when the ruleset has no archetypes', () => {
      const config = withArchetypes({ archetypes: [] });
      const pointBuy = config.curves?.[0];
      if (pointBuy) {
        pointBuy.columns = [{ id: 'col-non', name: 'non' }];
        pointBuy.rows = [{ key: 1, values: [1] }];
      }

      const { errors } = validateConfiguration(config);

      expect(errors.filter((issue) => issue.message.includes('column'))).toEqual([]);
    });

    it('should say nothing at all when the ruleset defines no archetypes', () => {
      const config = withArchetypes();
      config.archetypes = undefined;

      const result = validateConfiguration(config);

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('dice ladders (TICKET-ROLL-03)', () => {
    /** The sheet's `[20, 12, 6]` ladder on an otherwise minimal ruleset */
    function withLadder(overrides: Partial<DiceLadder> = {}): Configuration {
      const config = createMinimalConfig();
      config.diceLadders = [
        {
          id: 'ladder-standard',
          name: 'Standard',
          description: '',
          dieSizes: [20, 12, 6],
          showZeroTerms: true,
          remainder: 'flat',
          ...overrides,
        },
      ];
      return config;
    }

    /** Every ladder message, whatever severity it came back under */
    function ladderIssues(config: Configuration): string[] {
      const report = validateConfiguration(config);
      return [...report.errors, ...report.warnings, ...report.information]
        .filter((issue) => issue.category === 'Dice Ladder Validation')
        .map((issue) => issue.message);
    }

    it('should accept the sheet ladder without comment', () => {
      expect(ladderIssues(withLadder())).toEqual([]);
    });

    it('should say nothing when the ruleset defines no ladders', () => {
      const result = validateConfiguration(createMinimalConfig());

      expect(result.errors).toEqual([]);
      expect(result.information).toEqual([]);
    });

    it('should name a ladder with no die sizes', () => {
      const messages = ladderIssues(withLadder({ dieSizes: [] }));

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('"Standard" has no die sizes');
    });

    it('should name a die size that is not a positive whole number', () => {
      const messages = ladderIssues(withLadder({ dieSizes: [20, 0] }));

      expect(messages.some((message) => message.includes('not a positive whole number: 0'))).toBe(
        true
      );
    });

    it('should name a ladder that is not sorted largest die first', () => {
      const messages = ladderIssues(withLadder({ dieSizes: [6, 20] }));

      expect(messages).toContain(
        'Dice ladder "Standard" is not sorted largest die first: 20 follows 6'
      );
    });

    it('should treat a repeated die size as unsorted, since it is not strictly descending', () => {
      const messages = ladderIssues(withLadder({ dieSizes: [12, 12] }));

      expect(messages.some((message) => message.includes('not sorted largest die first'))).toBe(
        true
      );
    });

    it('should refuse a cap that allows no dice at all', () => {
      const messages = ladderIssues(withLadder({ maxPerDie: 0 }));

      expect(messages.some((message) => message.includes('caps each die at 0'))).toBe(true);
    });

    it('should refuse a roll whose ladder does not exist (TICKET-ROLL-05)', () => {
      const config = withLadder();
      config.rollDefinitions = [
        {
          id: 'roll-melee',
          name: 'Melee',
          description: '',
          input: 'STR',
          ladderId: 'ladder-that-went-away',
          order: 0,
        },
      ];

      const { errors } = validateConfiguration(config);

      expect(errors.map((issue) => issue.message)).toContain(
        'Roll "Melee" uses a dice ladder that does not exist: ladder-that-went-away'
      );
    });

    it('should validate a roll input at its own attachment point (TICKET-ROLL-05)', () => {
      const config = withLadder();
      config.rollDefinitions = [
        {
          id: 'roll-melee',
          name: 'Melee',
          description: '',
          input: 'STR + NOPE',
          ladderId: 'ladder-standard',
          order: 0,
        },
      ];

      const { errors, isValid } = validateConfiguration(config);

      expect(isValid).toBe(false);
      expect(errors.some((issue) => issue.message.startsWith('Roll "Melee":'))).toBe(true);
    });

    it('should accept a roll reading a stat down a ladder that exists', () => {
      const config = withLadder();
      config.rollDefinitions = [
        {
          id: 'roll-melee',
          name: 'Melee',
          description: '',
          input: 'stats.strength + 2',
          ladderId: 'ladder-standard',
          category: 'offence',
          order: 0,
        },
      ];

      expect(validateConfiguration(config).errors).toEqual([]);
    });

    it('should report a large smallest die as information rather than as a defect', () => {
      const config = withLadder({ dieSizes: [20, 12] });
      const report = validateConfiguration(config);

      expect(report.errors).toEqual([]);
      expect(report.isValid).toBe(true);
      expect(report.information.map((issue) => issue.message)).toEqual([
        'Dice ladder "Standard" has no die smaller than 12, so up to 11 of any value stays a flat bonus',
      ]);
    });
  });
});
