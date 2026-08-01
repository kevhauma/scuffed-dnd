/**
 * Formula Change Guard Tests
 *
 * **Validates: Requirements 16.5, 16.6, 2.3, 3.5**
 */

import { describe, it, expect } from 'vitest';
import type { Configuration } from '../../types/config';
import { validateFormulaChange } from './formulaChange';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    mainSkills: [
      { code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
      { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 20 },
      { code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
    ],
    stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
    specialitySkills: [
      { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'DEX / 2' },
    ],
    combatSkills: [
      {
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
        { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'ACR' },
        { code: 'ACR', name: 'Acrobatics', description: '', maxBaseLevel: 10, bonusFormula: 'DEX' },
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
    expect(result.errors.join(' ')).toMatch(/Circular dependency detected: (STL → ACR → STL|ACR → STL → ACR)/);
  });

  it('should evaluate the post-save state, catching an edit that turns a valid formula circular', () => {
    const config = createConfig({
      specialitySkills: [
        { code: 'STL', name: 'Stealth', description: '', maxBaseLevel: 10, bonusFormula: 'ACR' },
        { code: 'ACR', name: 'Acrobatics', description: '', maxBaseLevel: 10, bonusFormula: 'DEX' },
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
