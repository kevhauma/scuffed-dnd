/**
 * Formula Validator Tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateFormula,
  detectCircularDependencies,
  validateFormulaCollection,
  type FormulaDependency,
} from './validator';

describe('validateFormula', () => {
  describe('syntax validation', () => {
    it('should validate a simple valid formula', () => {
      const result = validateFormula('STR + DEX');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.referencedVariables).toEqual(['STR', 'DEX']);
    });

    it('should validate a complex valid formula', () => {
      const result = validateFormula('(STR * 10 + CON * 5) / 2');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.referencedVariables).toEqual(['STR', 'CON']);
    });

    it('should validate formula with unary operators', () => {
      const result = validateFormula('-STR + DEX');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.referencedVariables).toEqual(['STR', 'DEX']);
    });

    it('should reject empty formula', () => {
      const result = validateFormula('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula cannot be empty');
    });

    it('should reject formula with only whitespace', () => {
      const result = validateFormula('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formula cannot be empty');
    });

    it('should reject formula with syntax error - unmatched parenthesis', () => {
      const result = validateFormula('(STR + DEX');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Expected token type RPAREN');
    });

    it('should reject formula with syntax error - invalid character', () => {
      const result = validateFormula('STR & DEX');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unexpected character');
    });

    it('should reject formula with syntax error - missing operand', () => {
      const result = validateFormula('STR +');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept formula with unary plus (double plus is valid)', () => {
      // STR ++ DEX is parsed as STR + (+DEX), which is valid
      const result = validateFormula('STR ++ DEX');
      expect(result.isValid).toBe(true);
      expect(result.referencedVariables).toEqual(['STR', 'DEX']);
    });
  });

  describe('variable extraction', () => {
    it('should extract single variable', () => {
      const result = validateFormula('STR');
      expect(result.referencedVariables).toEqual(['STR']);
    });

    it('should extract multiple variables', () => {
      const result = validateFormula('STR + DEX + CON');
      expect(result.referencedVariables).toEqual(['STR', 'DEX', 'CON']);
    });

    it('should extract variables from nested expressions', () => {
      const result = validateFormula('(STR + DEX) * (CON + WIS)');
      expect(result.referencedVariables).toEqual(['STR', 'DEX', 'CON', 'WIS']);
    });

    it('should extract unique variables only', () => {
      const result = validateFormula('STR + STR + DEX');
      expect(result.referencedVariables).toEqual(['STR', 'DEX']);
    });

    it('should normalize variable names to uppercase', () => {
      const result = validateFormula('str + dex');
      expect(result.referencedVariables).toEqual(['STR', 'DEX']);
    });

    it('should return empty array for formula with no variables', () => {
      const result = validateFormula('10 + 20');
      expect(result.referencedVariables).toEqual([]);
    });
  });

  describe('undefined variable detection', () => {
    it('should detect undefined variable', () => {
      const availableVars = new Set(['STR', 'DEX', 'CON']);
      const result = validateFormula('STR + WIS', availableVars);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Undefined variable: WIS');
      expect(result.referencedVariables).toEqual(['STR', 'WIS']);
    });

    it('should detect multiple undefined variables', () => {
      const availableVars = new Set(['STR', 'DEX']);
      const result = validateFormula('STR + CON + WIS', availableVars);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Undefined variables: CON, WIS');
      expect(result.referencedVariables).toEqual(['STR', 'CON', 'WIS']);
    });

    it('should pass when all variables are defined', () => {
      const availableVars = new Set(['STR', 'DEX', 'CON']);
      const result = validateFormula('STR + DEX + CON', availableVars);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should not check undefined variables when availableVariables not provided', () => {
      const result = validateFormula('STR + UNDEFINED');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.referencedVariables).toEqual(['STR', 'UNDEFINED']);
    });
  });
});

describe('detectCircularDependencies', () => {
  it('should detect simple circular dependency (A → B → A)', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: 'B + 10', referencedVariables: ['B'] },
      { id: 'B', formula: 'A + 5', referencedVariables: ['A'] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles.length).toBeGreaterThan(0);
    
    // Check that we found a cycle containing both A and B
    const cycle = cycles[0];
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
  });

  it('should detect three-way circular dependency (A → B → C → A)', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: 'B + 10', referencedVariables: ['B'] },
      { id: 'B', formula: 'C + 5', referencedVariables: ['C'] },
      { id: 'C', formula: 'A + 3', referencedVariables: ['A'] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles.length).toBeGreaterThan(0);
    
    const cycle = cycles[0];
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
    expect(cycle).toContain('C');
  });

  it('should detect self-referencing formula (A → A)', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: 'A + 10', referencedVariables: ['A'] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('A');
  });

  it('should not detect cycles in acyclic dependency graph', () => {
    const formulas: FormulaDependency[] = [
      { id: 'HEALTH', formula: 'STR * 10 + CON * 5', referencedVariables: ['STR', 'CON'] },
      { id: 'MANA', formula: 'WIS * 8 + INT * 6', referencedVariables: ['WIS', 'INT'] },
      { id: 'SPEED', formula: 'DEX * 2', referencedVariables: ['DEX'] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles).toHaveLength(0);
  });

  it('should handle formulas referencing non-formula variables', () => {
    const formulas: FormulaDependency[] = [
      { id: 'HEALTH', formula: 'STR * 10', referencedVariables: ['STR'] },
      { id: 'MANA', formula: 'HEALTH + WIS', referencedVariables: ['HEALTH', 'WIS'] },
    ];

    // STR and WIS are not formulas, so no cycle
    const cycles = detectCircularDependencies(formulas);
    expect(cycles).toHaveLength(0);
  });

  it('should detect cycle in complex dependency graph', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: 'B + C', referencedVariables: ['B', 'C'] },
      { id: 'B', formula: 'D + 10', referencedVariables: ['D'] },
      { id: 'C', formula: 'E + 5', referencedVariables: ['E'] },
      { id: 'D', formula: 'A + 3', referencedVariables: ['A'] }, // Creates cycle: A → B → D → A
      { id: 'E', formula: 'F + 2', referencedVariables: ['F'] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles.length).toBeGreaterThan(0);
    
    // Should find cycle involving A, B, D
    const cycle = cycles[0];
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
    expect(cycle).toContain('D');
  });

  it('should handle empty formula list', () => {
    const cycles = detectCircularDependencies([]);
    expect(cycles).toHaveLength(0);
  });

  it('should handle single formula with no dependencies', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: '10 + 20', referencedVariables: [] },
    ];

    const cycles = detectCircularDependencies(formulas);
    expect(cycles).toHaveLength(0);
  });
});

describe('validateFormulaCollection', () => {
  it('should validate collection without circular dependencies', () => {
    const formulas: FormulaDependency[] = [
      { id: 'HEALTH', formula: 'STR * 10', referencedVariables: ['STR'] },
      { id: 'MANA', formula: 'WIS * 8', referencedVariables: ['WIS'] },
    ];

    const result = validateFormulaCollection(formulas);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect circular dependencies in collection', () => {
    const formulas: FormulaDependency[] = [
      { id: 'A', formula: 'B + 10', referencedVariables: ['B'] },
      { id: 'B', formula: 'A + 5', referencedVariables: ['A'] },
    ];

    const result = validateFormulaCollection(formulas);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Circular dependency detected');
  });

  it('should collect all referenced variables', () => {
    const formulas: FormulaDependency[] = [
      { id: 'HEALTH', formula: 'STR * 10 + CON * 5', referencedVariables: ['STR', 'CON'] },
      { id: 'MANA', formula: 'WIS * 8 + INT * 6', referencedVariables: ['WIS', 'INT'] },
    ];

    const result = validateFormulaCollection(formulas);
    expect(result.referencedVariables).toContain('STR');
    expect(result.referencedVariables).toContain('CON');
    expect(result.referencedVariables).toContain('WIS');
    expect(result.referencedVariables).toContain('INT');
  });

  it('should handle empty collection', () => {
    const result = validateFormulaCollection([]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.referencedVariables).toHaveLength(0);
  });
});
