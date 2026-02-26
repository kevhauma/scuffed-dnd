/**
 * Formula Evaluator Tests
 */

import { describe, it, expect } from 'vitest';
import { evaluateFormula } from './evaluator';
import { parseFormula } from './parser';
import type { FormulaContext } from '../../types/formula';

describe('Formula Evaluator', () => {
  describe('Number literals', () => {
    it('should evaluate integer literals', () => {
      const ast = parseFormula('42');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(42);
    });

    it('should evaluate decimal literals', () => {
      const ast = parseFormula('3.14');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(3.14);
    });

    it('should evaluate zero', () => {
      const ast = parseFormula('0');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(0);
    });
  });

  describe('Variable references', () => {
    it('should evaluate single variable', () => {
      const ast = parseFormula('STR');
      const context: FormulaContext = { variables: { STR: 15 } };
      expect(evaluateFormula(ast, context)).toBe(15);
    });

    it('should throw error for undefined variable', () => {
      const ast = parseFormula('STR');
      const context: FormulaContext = { variables: {} };
      expect(() => evaluateFormula(ast, context)).toThrow('Undefined variable: STR');
    });

    it('should handle multiple different variables', () => {
      const ast = parseFormula('STR + DEX');
      const context: FormulaContext = { variables: { STR: 10, DEX: 12 } };
      expect(evaluateFormula(ast, context)).toBe(22);
    });
  });

  describe('Addition', () => {
    it('should add two numbers', () => {
      const ast = parseFormula('5 + 3');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(8);
    });

    it('should add variables', () => {
      const ast = parseFormula('STR + DEX');
      const context: FormulaContext = { variables: { STR: 10, DEX: 8 } };
      expect(evaluateFormula(ast, context)).toBe(18);
    });

    it('should add multiple terms', () => {
      const ast = parseFormula('1 + 2 + 3 + 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(10);
    });

    it('should handle decimal addition', () => {
      const ast = parseFormula('1.5 + 2.5');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(4);
    });
  });

  describe('Subtraction', () => {
    it('should subtract two numbers', () => {
      const ast = parseFormula('10 - 3');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(7);
    });

    it('should subtract variables', () => {
      const ast = parseFormula('STR - DEX');
      const context: FormulaContext = { variables: { STR: 15, DEX: 8 } };
      expect(evaluateFormula(ast, context)).toBe(7);
    });

    it('should handle negative results', () => {
      const ast = parseFormula('5 - 10');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(-5);
    });

    it('should handle multiple subtractions', () => {
      const ast = parseFormula('20 - 5 - 3');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(12);
    });
  });

  describe('Multiplication', () => {
    it('should multiply two numbers', () => {
      const ast = parseFormula('5 * 3');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(15);
    });

    it('should multiply variables', () => {
      const ast = parseFormula('STR * 2');
      const context: FormulaContext = { variables: { STR: 10 } };
      expect(evaluateFormula(ast, context)).toBe(20);
    });

    it('should handle multiplication by zero', () => {
      const ast = parseFormula('42 * 0');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(0);
    });

    it('should handle decimal multiplication', () => {
      const ast = parseFormula('2.5 * 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(10);
    });
  });

  describe('Division', () => {
    it('should divide two numbers', () => {
      const ast = parseFormula('15 / 3');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(5);
    });

    it('should divide variables', () => {
      const ast = parseFormula('STR / 2');
      const context: FormulaContext = { variables: { STR: 20 } };
      expect(evaluateFormula(ast, context)).toBe(10);
    });

    it('should handle decimal division', () => {
      const ast = parseFormula('10 / 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(2.5);
    });

    it('should throw error on division by zero', () => {
      const ast = parseFormula('10 / 0');
      const context: FormulaContext = { variables: {} };
      expect(() => evaluateFormula(ast, context)).toThrow('Division by zero');
    });

    it('should throw error on division by zero variable', () => {
      const ast = parseFormula('STR / DEX');
      const context: FormulaContext = { variables: { STR: 10, DEX: 0 } };
      expect(() => evaluateFormula(ast, context)).toThrow('Division by zero');
    });
  });

  describe('Operator precedence', () => {
    it('should handle multiplication before addition', () => {
      const ast = parseFormula('2 + 3 * 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(14); // 2 + (3 * 4) = 14
    });

    it('should handle division before subtraction', () => {
      const ast = parseFormula('10 - 6 / 2');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(7); // 10 - (6 / 2) = 7
    });

    it('should handle multiple precedence levels', () => {
      const ast = parseFormula('2 + 3 * 4 - 6 / 2');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(11); // 2 + 12 - 3 = 11
    });

    it('should handle left-to-right evaluation for same precedence', () => {
      const ast = parseFormula('10 - 5 - 2');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(3); // (10 - 5) - 2 = 3
    });
  });

  describe('Parentheses', () => {
    it('should override precedence with parentheses', () => {
      const ast = parseFormula('(2 + 3) * 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(20); // (2 + 3) * 4 = 20
    });

    it('should handle nested parentheses', () => {
      const ast = parseFormula('((2 + 3) * 4) / 2');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(10);
    });

    it('should handle multiple parenthesized groups', () => {
      const ast = parseFormula('(2 + 3) * (4 + 1)');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(25); // 5 * 5 = 25
    });
  });

  describe('Unary operators', () => {
    it('should handle unary minus on number', () => {
      const ast = parseFormula('-5');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(-5);
    });

    it('should handle unary minus on variable', () => {
      const ast = parseFormula('-STR');
      const context: FormulaContext = { variables: { STR: 10 } };
      expect(evaluateFormula(ast, context)).toBe(-10);
    });

    it('should handle unary minus in expression', () => {
      const ast = parseFormula('10 + -5');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(5);
    });

    it('should handle double negation', () => {
      const ast = parseFormula('--5');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(5);
    });

    it('should handle unary plus', () => {
      const ast = parseFormula('+5');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(5);
    });
  });

  describe('Complex expressions', () => {
    it('should evaluate stat formula (STR * 10 + CON * 5)', () => {
      const ast = parseFormula('STR * 10 + CON * 5');
      const context: FormulaContext = { variables: { STR: 15, CON: 12 } };
      expect(evaluateFormula(ast, context)).toBe(210); // 150 + 60 = 210
    });

    it('should evaluate speciality skill bonus ((STR + DEX) / 2)', () => {
      const ast = parseFormula('(STR + DEX) / 2');
      const context: FormulaContext = { variables: { STR: 10, DEX: 14 } };
      expect(evaluateFormula(ast, context)).toBe(12); // 24 / 2 = 12
    });

    it('should evaluate combat skill bonus (STR + MEL)', () => {
      const ast = parseFormula('STR + MEL');
      const context: FormulaContext = { variables: { STR: 15, MEL: 8 } };
      expect(evaluateFormula(ast, context)).toBe(23);
    });

    it('should handle complex nested formula', () => {
      const ast = parseFormula('(STR * 2 + DEX) * (CON - 5) / 10');
      const context: FormulaContext = { variables: { STR: 10, DEX: 8, CON: 15 } };
      expect(evaluateFormula(ast, context)).toBe(28); // (20 + 8) * 10 / 10 = 28
    });

    it('should handle formula with all operators', () => {
      const ast = parseFormula('10 + 5 * 2 - 8 / 4');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(18); // 10 + 10 - 2 = 18
    });
  });

  describe('Edge cases', () => {
    it('should handle zero values in context', () => {
      const ast = parseFormula('STR + DEX');
      const context: FormulaContext = { variables: { STR: 0, DEX: 5 } };
      expect(evaluateFormula(ast, context)).toBe(5);
    });

    it('should handle negative values in context', () => {
      const ast = parseFormula('STR + DEX');
      const context: FormulaContext = { variables: { STR: -5, DEX: 10 } };
      expect(evaluateFormula(ast, context)).toBe(5);
    });

    it('should handle large numbers', () => {
      const ast = parseFormula('1000 * 1000');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBe(1000000);
    });

    it('should handle very small decimals', () => {
      const ast = parseFormula('0.1 + 0.2');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toBeCloseTo(0.3);
    });
  });
});
