/**
 * Formula Change Guard Tests
 *
 * **Validates: Requirements 16.5, 16.6, 2.3, 3.5**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration, Stat } from '../../types/config';
import { validateFormulaChange } from './formulaChange';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
    stats: [
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
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'CON',
        name: 'Constitution',
        abbreviation: 'CON',
        description: '',
        order: 2,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    // A `Skill` carries weight rows rather than a formula, so it is neither an attachment point
    // nor a node in the dependency graph (TICKET-SKL-02), and a combat skill no longer exists
    // (TICKET-ROLL-06) — so every cycle case below is written over **derived stats**, the one
    // formula-carrying entity the model still has.
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'DEX', weight: 0.3 }],
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/**
 * A derived stat, keyed by the graph key it uses
 *
 * **The only formula-carrying entity left** since TICKET-ROLL-06 retired combat skills, which is
 * what every cycle case below is now written over. `id`, `name` and `abbreviation` are the same
 * string, which keeps a cycle readable as `MEL → MEL` — but nothing depends on that alignment any
 * more (CR-01): the ids-are-UUIDs suite at the bottom of this file is the case that matters.
 */
function derivedStat(code: string, formula: string): Stat {
  return {
    id: code,
    name: code,
    abbreviation: code,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    formula,
  };
}

describe('validateFormulaChange', () => {
  it('should refuse a formula that references its own entity, naming the cycle', () => {
    const config = createConfig({
      stats: [...createConfig().stats, derivedStat('MEL', 'STR * 2')],
    });

    const result = validateFormulaChange(config, {
      owner: 'stat',
      id: 'MEL',
      formula: 'MEL + 1',
      previousId: 'MEL',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Circular dependency detected: MEL → MEL');
  });

  it('should refuse an indirect cycle and name the whole chain', () => {
    // A configuration that could only have arrived by import: two derived stats that reference
    // each other. Saving an edit to either one must be refused.
    const config = createConfig({
      stats: [...createConfig().stats, derivedStat('MEL', 'RNG'), derivedStat('RNG', 'DEX')],
    });

    const result = validateFormulaChange(config, {
      owner: 'stat',
      id: 'RNG',
      formula: 'MEL + 1',
      previousId: 'RNG',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(
      /Circular dependency detected: (MEL → RNG → MEL|RNG → MEL → RNG)/
    );
  });

  it('should evaluate the post-save state, catching an edit that turns a valid formula circular', () => {
    const config = createConfig({
      stats: [...createConfig().stats, derivedStat('MEL', 'RNG'), derivedStat('RNG', 'DEX')],
    });

    // As it stands the configuration is acyclic — the cycle only exists after the edit
    const before = validateFormulaChange(config, {
      owner: 'stat',
      id: 'RNG',
      formula: 'DEX + 1',
      previousId: 'RNG',
    });
    expect(before.isValid).toBe(true);

    const after = validateFormulaChange(config, {
      owner: 'stat',
      id: 'RNG',
      formula: 'MEL',
      previousId: 'RNG',
    });
    expect(after.isValid).toBe(false);
    expect(after.errors.join(' ')).toMatch(/Circular dependency/);
  });

  it('should accept a formula that legitimately references several stats', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'armour',
      formula: 'STR * 2 + DEX + CON / 2',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.referencedVariables.sort()).toEqual(['CON', 'DEX', 'STR']);
  });

  it('should refuse a stat formula referencing a skill, which it can never evaluate (CR-02)', () => {
    // Skills are computed from the finished stat values, so `calculateStatValues` has no skill
    // resolver — this used to validate, preview a real number, save, and then error on the sheet
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'RNG',
      formula: 'DEX + skills.stealth',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Namespace not available here: skills');
  });

  it('should still accept a roll input referencing a skill, which is honoured (CR-02)', () => {
    // The same reference at the attachment point whose calculator *does* get skill values
    const result = validateFormulaChange(createConfig(), {
      owner: 'roll-input',
      id: 'roll-stealth',
      formula: 'DEX + skills.stealth',
    });

    expect(result.isValid).toBe(true);
  });

  it('should refuse a formula referencing an undefined code, naming the code', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'mana',
      formula: 'WIS * 5',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('WIS');
  });

  it('should refuse a curve generator naming a stat, which is not in scope for it', () => {
    // A generator fills a table, not a character — the scope table's narrowest row
    const result = validateFormulaChange(createConfig(), {
      owner: 'curve-generator',
      id: 'xp_required',
      formula: 'STR + 1',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('STR');
  });

  it('should refuse an unparseable formula', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'health',
      formula: 'STR * * 2',
      previousId: 'health',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should refuse an empty formula', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'health',
      formula: '   ',
      previousId: 'health',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Formula cannot be empty');
  });

  it('should not report a cycle against the entry being replaced when a code is renamed', () => {
    // Editing MEL and renaming it to AGI: the old MEL entry must not linger in the graph and
    // collide with the new formula
    const config = createConfig({
      stats: [...createConfig().stats, derivedStat('MEL', 'AGI'), derivedStat('AGI', 'DEX')],
    });

    const result = validateFormulaChange(config, {
      owner: 'stat',
      id: 'AGI',
      formula: 'DEX / 2',
      previousId: 'MEL',
    });

    expect(result.isValid).toBe(true);
  });
});

describe('Namespace scoping (TICKET-FORM-04)', () => {
  describe('the three scoping errors', () => {
    it('names a namespace the engine has never heard of', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'wibble.thing + 1',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown namespace: wibble');
    });

    it('names a real namespace that is out of scope at this attachment point', () => {
      // `stats` is available to stats and combat skills, not to a curve generator
      const result = validateFormulaChange(createConfig(), {
        owner: 'curve-generator',
        id: 'xp_required',
        formula: 'stats.health + 1',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Namespace not available here: stats');
    });

    it('names a member the namespace does not provide', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'stats.nonexistent + 1',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown member: stats.nonexistent');
    });

    it('distinguishes the three from each other in one formula', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'curve-generator',
        id: 'xp_required',
        formula: 'wibble.a + stats.health + const.nope',
      });

      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Unknown namespace: wibble',
          'Namespace not available here: stats',
          'Unknown member: const.nope',
        ])
      );
    });

    it('accepts an in-scope namespace and member', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        // `health` is a stat in the base config, and stats are in scope for a stat formula
        formula: 'stats.health + 1',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.namespacedReferences).toEqual([{ namespace: 'stats', member: 'health' }]);
    });

    it('reports every member of an entity-less namespace as unknown', () => {
      // `const` is in scope for a stat, but this ruleset defines no constants
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'const.bonus_divider',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unknown member: const.bonus_divider');
    });
  });

  describe('cycle detection across namespaced references', () => {
    it('blocks a self-reference written in namespaced syntax, naming the path', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'health',
        formula: 'stats.health + 1',
        previousId: 'health',
      });

      expect(result.isValid).toBe(false);
      // Named, not id'd: the chain is graph node ids, spelled back out through each node's label
      expect(result.errors[0]).toBe('Circular dependency detected: Health → Health');
    });

    it('blocks a two-formula cycle written in namespaced syntax, naming the path', () => {
      const config = createConfig({
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
            formula: 'stats.armour + 1',
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
            formula: 'STR * 2',
          },
        ],
      });

      const result = validateFormulaChange(config, {
        owner: 'stat',
        id: 'armour',
        formula: 'stats.health + 1',
        previousId: 'armour',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(
        /Circular dependency detected: (Health → Armour → Health|Armour → Health → Armour)/
      );
    });

    it('leaves an acyclic chain written in namespaced syntax alone', () => {
      // A stat reading another stat is a chain, not a cycle
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'RNG',
        formula: 'stats.health + 1',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('cannot cycle through a skill, because a skill holds no formula (TICKET-SKL-02)', () => {
      // The one cycle v1 could build here — speciality A names B names A — is gone with the
      // formula string. A weight row points at a stat and nothing points back at a skill through
      // it, so `skills.*` is a leaf in the graph. Written at the roll attachment point, which is
      // the one that may name a skill at all since CR-02.
      const config = createConfig({
        rollDefinitions: [
          {
            id: 'roll-stealth',
            name: 'Stealth',
            description: '',
            input: 'skills.stealth',
            ladderId: 'ladder',
            order: 0,
          },
        ],
      });

      const result = validateFormulaChange(config, {
        owner: 'roll-input',
        id: 'roll-stealth',
        formula: 'skills.stealth * 2',
        previousId: 'roll-stealth',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('legacy bare-code scoping', () => {
    it('still lets a stat name another stat by its abbreviation', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'STR * 2',
      });

      expect(result.isValid).toBe(true);
    });

    it('refuses any formula naming a skill by a bare code (TICKET-SKL-02)', () => {
      // v1 gave a speciality skill a 3-letter code in this flat space. A `Skill` has none, so the
      // spelling is undefined for every attachment point rather than merely out of scope for some.
      for (const owner of ['stat', 'roll-input'] as const) {
        const result = validateFormulaChange(createConfig(), {
          owner,
          id: 'armour',
          formula: 'STL * 2',
        });

        expect(result.isValid, owner).toBe(false);
        expect(result.errors, owner).toContain('Undefined variable: STL');
      }
    });

    it('still lets a formula name a stat by its abbreviation', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'RNG',
        formula: 'DEX + CON',
      });

      expect(result.isValid).toBe(true);
    });
  });
});

describe('Cycle detection with ids that are not the formula spelling (CR-01)', () => {
  // The case every real configuration is in: ids are `crypto.randomUUID()` and formulas are in
  // display form. Before CR-01 the graph was keyed by id and its edges were spellings, so no edge
  // ever matched a node and every cycle — including a direct self-reference — saved cleanly.
  const ALPHA_ID = '7c22b0f1-0000-4000-8000-000000000001';
  const BETA_ID = '7c22b0f1-0000-4000-8000-000000000002';

  function uuidConfig(alphaFormula: string, betaFormula: string): Configuration {
    return createConfig({
      stats: [
        {
          id: ALPHA_ID,
          name: 'Alpha',
          abbreviation: 'ALP',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: alphaFormula,
        },
        {
          id: BETA_ID,
          name: 'Beta',
          abbreviation: 'BET',
          description: '',
          order: 1,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: betaFormula,
        },
      ],
    });
  }

  it('refuses a stat that names itself by its slug', () => {
    const result = validateFormulaChange(uuidConfig('1', '1'), {
      owner: 'stat',
      id: ALPHA_ID,
      formula: 'stats.alpha * 2',
      previousId: ALPHA_ID,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Circular dependency detected: Alpha → Alpha');
  });

  it('refuses a stat that names itself by its abbreviation', () => {
    const result = validateFormulaChange(uuidConfig('1', '1'), {
      owner: 'stat',
      id: ALPHA_ID,
      formula: 'ALP + 1',
      previousId: ALPHA_ID,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Circular dependency detected: Alpha → Alpha');
  });

  it('refuses a mutual cycle and names both stats', () => {
    const result = validateFormulaChange(uuidConfig('stats.beta + 1', '1'), {
      owner: 'stat',
      id: BETA_ID,
      formula: 'stats.alpha + 1',
      previousId: BETA_ID,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(
      /Circular dependency detected: (Alpha → Beta → Alpha|Beta → Alpha → Beta)/
    );
  });

  it('still accepts an acyclic chain between the same stats', () => {
    const result = validateFormulaChange(uuidConfig('1', '1'), {
      owner: 'stat',
      id: BETA_ID,
      formula: 'stats.alpha + ALP',
      previousId: BETA_ID,
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('does not confuse a constant with a stat that shares its spelling', () => {
    // Namespace-aware resolution: `const.alpha` is a different entity from `stats.alpha`, so it
    // contributes no edge back to the stat and closes no cycle
    const config = uuidConfig('1', '1');
    const result = validateFormulaChange(
      {
        ...config,
        constants: [
          { id: 'c1', name: 'alpha', displayName: 'Alpha divider', description: '', value: 2 },
        ],
      },
      {
        owner: 'stat',
        id: ALPHA_ID,
        formula: 'const.alpha * 2',
        previousId: ALPHA_ID,
      }
    );

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
