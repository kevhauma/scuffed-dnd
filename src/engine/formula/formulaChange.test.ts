/**
 * Formula Change Guard Tests
 *
 * **Validates: Requirements 16.5, 16.6, 2.3, 3.5**
 */

import { describe, expect, it } from 'vitest';
import type { Configuration } from '../../types/config';
import { validateFormulaChange } from './formulaChange';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 3,
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
    specialitySkills: [
      {
        id: 'STL',
        code: 'STL',
        name: 'Stealth',
        description: '',
        maxBaseLevel: 10,
        bonusFormula: 'DEX / 2',
      },
    ],
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR + STL',
      },
    ],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('validateFormulaChange', () => {
  it('should refuse a formula that references its own entity, naming the cycle', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'speciality-skill',
      id: 'STL',
      formula: 'STL + 1',
      previousId: 'STL',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toBe('Circular dependency detected: STL → STL');
  });

  it('should refuse an indirect cycle and name the whole chain', () => {
    // A configuration that could only have arrived by import: two speciality skills that
    // reference each other. Saving an edit to either one must be refused.
    const config = createConfig({
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'ACR',
        },
        {
          id: 'ACR',
          code: 'ACR',
          name: 'Acrobatics',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'DEX',
        },
      ],
      combatSkills: [],
    });

    const result = validateFormulaChange(config, {
      owner: 'speciality-skill',
      id: 'ACR',
      formula: 'STL + 1',
      previousId: 'ACR',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(
      /Circular dependency detected: (STL → ACR → STL|ACR → STL → ACR)/
    );
  });

  it('should evaluate the post-save state, catching an edit that turns a valid formula circular', () => {
    const config = createConfig({
      specialitySkills: [
        {
          id: 'STL',
          code: 'STL',
          name: 'Stealth',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'ACR',
        },
        {
          id: 'ACR',
          code: 'ACR',
          name: 'Acrobatics',
          description: '',
          maxBaseLevel: 10,
          bonusFormula: 'DEX',
        },
      ],
      combatSkills: [],
    });

    // As it stands the configuration is acyclic — the cycle only exists after the edit
    const before = validateFormulaChange(config, {
      owner: 'speciality-skill',
      id: 'ACR',
      formula: 'DEX + 1',
      previousId: 'ACR',
    });
    expect(before.isValid).toBe(true);

    const after = validateFormulaChange(config, {
      owner: 'speciality-skill',
      id: 'ACR',
      formula: 'STL',
      previousId: 'ACR',
    });
    expect(after.isValid).toBe(false);
    expect(after.errors.join(' ')).toMatch(/Circular dependency/);
  });

  it('should accept a formula that legitimately references several skills', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'stat',
      id: 'armour',
      formula: 'STR * 2 + DEX + CON / 2',
    });

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.referencedVariables.sort()).toEqual(['CON', 'DEX', 'STR']);
  });

  it('should accept a combat formula referencing a speciality skill', () => {
    const result = validateFormulaChange(createConfig(), {
      owner: 'combat-skill',
      id: 'RNG',
      formula: 'DEX + STL',
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

  it('should refuse a speciality formula referencing a speciality code, which is not in scope for it', () => {
    // Requirement 3.3 — speciality formulas reference main skills only
    const result = validateFormulaChange(createConfig(), {
      owner: 'speciality-skill',
      id: 'ACR',
      formula: 'STL + 1',
    });

    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('STL');
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
    // Editing STL and renaming it to AGI: the old STL entry must not linger in the graph
    const config = createConfig({ combatSkills: [] });

    const result = validateFormulaChange(config, {
      owner: 'speciality-skill',
      id: 'AGI',
      formula: 'DEX / 2',
      previousId: 'STL',
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
      // `skills` is available to stats and combat skills, not to a speciality skill's own level
      const result = validateFormulaChange(createConfig(), {
        owner: 'speciality-skill',
        id: 'ACR',
        formula: 'skills.STL + 1',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Namespace not available here: skills');
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
        owner: 'speciality-skill',
        id: 'ACR',
        formula: 'wibble.a + skills.STL + stats.nope',
      });

      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Unknown namespace: wibble',
          'Namespace not available here: skills',
          'Unknown member: stats.nope',
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

    it('reports every member of an entity-less namespace as unknown until its ticket lands', () => {
      // `const` is in scope for a stat but has no members until TICKET-CST-01
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
      expect(result.errors[0]).toBe('Circular dependency detected: health → health');
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
        /Circular dependency detected: (health → armour → health|armour → health → armour)/
      );
    });

    it('catches a cycle that mixes namespaced and bare syntax', () => {
      // An imported configuration where STL names ACR with a bare code. Closing the loop from
      // the other side with dotted syntax must still register as the same cycle — the two
      // spellings have to land on one graph node for that to work.
      const config = createConfig({
        specialitySkills: [
          {
            id: 'STL',
            code: 'STL',
            name: 'Stealth',
            description: '',
            maxBaseLevel: 10,
            bonusFormula: 'ACR',
          },
          {
            id: 'ACR',
            code: 'ACR',
            name: 'Acrobatics',
            description: '',
            maxBaseLevel: 10,
            bonusFormula: 'DEX',
          },
        ],
        combatSkills: [],
      });

      const result = validateFormulaChange(config, {
        owner: 'speciality-skill',
        id: 'ACR',
        formula: 'skills.STL + 1',
        previousId: 'ACR',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toMatch(
        /Circular dependency detected: (STL → ACR → STL|ACR → STL → ACR)/
      );
    });

    it('leaves an acyclic chain written in namespaced syntax alone', () => {
      // MEL → STL is a chain, not a cycle; `skills` is in scope for a combat skill
      const result = validateFormulaChange(createConfig(), {
        owner: 'combat-skill',
        id: 'RNG',
        formula: 'skills.STL + 1',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('legacy bare-code scoping is unchanged', () => {
    it('still lets a stat name a main skill', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'STR * 2',
      });

      expect(result.isValid).toBe(true);
    });

    it('still refuses a stat naming a speciality code', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'stat',
        id: 'armour',
        formula: 'STL * 2',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Undefined variable: STL');
    });

    it('still refuses a speciality skill naming another speciality code', () => {
      const config = createConfig({
        specialitySkills: [
          {
            id: 'STL',
            code: 'STL',
            name: 'Stealth',
            description: '',
            maxBaseLevel: 10,
            bonusFormula: 'DEX',
          },
          {
            id: 'ACR',
            code: 'ACR',
            name: 'Acrobatics',
            description: '',
            maxBaseLevel: 10,
            bonusFormula: 'DEX',
          },
        ],
        combatSkills: [],
      });

      const result = validateFormulaChange(config, {
        owner: 'speciality-skill',
        id: 'ACR',
        formula: 'STL + 1',
        previousId: 'ACR',
      });

      expect(result.isValid).toBe(false);
    });

    it('still lets a combat skill name both main and speciality codes', () => {
      const result = validateFormulaChange(createConfig(), {
        owner: 'combat-skill',
        id: 'RNG',
        formula: 'DEX + STL',
      });

      expect(result.isValid).toBe(true);
    });
  });
});
