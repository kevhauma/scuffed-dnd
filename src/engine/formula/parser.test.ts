/**
 * Formula Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { parseFormula } from './parser';
import type { FormulaAST } from '../../types/formula';

describe('Formula Parser', () => {
  describe('Number Literals', () => {
    it('should parse integer', () => {
      const ast = parseFormula('42');
      expect(ast).toEqual({
        type: 'number',
        value: 42,
      });
    });

    it('should parse decimal number', () => {
      const ast = parseFormula('3.14');
      expect(ast).toEqual({
        type: 'number',
        value: 3.14,
      });
    });

    it('should parse number with leading zero', () => {
      const ast = parseFormula('0.5');
      expect(ast).toEqual({
        type: 'number',
        value: 0.5,
      });
    });
  });

  describe('Variable References', () => {
    it('should parse 3-letter skill code', () => {
      const ast = parseFormula('STR');
      expect(ast).toEqual({
        type: 'variable',
        value: 'STR',
      });
    });

    it('should normalize lowercase to uppercase', () => {
      const ast = parseFormula('str');
      expect(ast).toEqual({
        type: 'variable',
        value: 'STR',
      });
    });

    it('should parse mixed case', () => {
      const ast = parseFormula('StR');
      expect(ast).toEqual({
        type: 'variable',
        value: 'STR',
      });
    });

    it('should parse variable with more than 3 letters', () => {
      // Parser doesn't enforce 3-letter limit, validator does
      const ast = parseFormula('STRENGTH');
      expect(ast).toEqual({
        type: 'variable',
        value: 'STRENGTH',
      });
    });
  });

  describe('Binary Operations', () => {
    it('should parse addition', () => {
      const ast = parseFormula('1 + 2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'number', value: 1 },
        right: { type: 'number', value: 2 },
      });
    });

    it('should parse subtraction', () => {
      const ast = parseFormula('5 - 3');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '-',
        left: { type: 'number', value: 5 },
        right: { type: 'number', value: 3 },
      });
    });

    it('should parse multiplication', () => {
      const ast = parseFormula('4 * 3');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '*',
        left: { type: 'number', value: 4 },
        right: { type: 'number', value: 3 },
      });
    });

    it('should parse division', () => {
      const ast = parseFormula('10 / 2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '/',
        left: { type: 'number', value: 10 },
        right: { type: 'number', value: 2 },
      });
    });

    it('should parse without spaces', () => {
      const ast = parseFormula('1+2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'number', value: 1 },
        right: { type: 'number', value: 2 },
      });
    });

    it('should parse with variables', () => {
      const ast = parseFormula('STR + DEX');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'variable', value: 'STR' },
        right: { type: 'variable', value: 'DEX' },
      });
    });
  });

  describe('Operator Precedence', () => {
    it('should respect multiplication before addition', () => {
      const ast = parseFormula('2 + 3 * 4');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'number', value: 2 },
        right: {
          type: 'binary_op',
          operator: '*',
          left: { type: 'number', value: 3 },
          right: { type: 'number', value: 4 },
        },
      });
    });

    it('should respect division before subtraction', () => {
      const ast = parseFormula('10 - 6 / 2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '-',
        left: { type: 'number', value: 10 },
        right: {
          type: 'binary_op',
          operator: '/',
          left: { type: 'number', value: 6 },
          right: { type: 'number', value: 2 },
        },
      });
    });

    it('should handle left-to-right for same precedence', () => {
      const ast = parseFormula('10 - 3 - 2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '-',
        left: {
          type: 'binary_op',
          operator: '-',
          left: { type: 'number', value: 10 },
          right: { type: 'number', value: 3 },
        },
        right: { type: 'number', value: 2 },
      });
    });

    it('should handle complex precedence with variables', () => {
      const ast = parseFormula('STR * 10 + CON * 5');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: {
          type: 'binary_op',
          operator: '*',
          left: { type: 'variable', value: 'STR' },
          right: { type: 'number', value: 10 },
        },
        right: {
          type: 'binary_op',
          operator: '*',
          left: { type: 'variable', value: 'CON' },
          right: { type: 'number', value: 5 },
        },
      });
    });
  });

  describe('Parentheses', () => {
    it('should parse simple parentheses', () => {
      const ast = parseFormula('(5)');
      expect(ast).toEqual({
        type: 'number',
        value: 5,
      });
    });

    it('should override precedence with parentheses', () => {
      const ast = parseFormula('(2 + 3) * 4');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '*',
        left: {
          type: 'binary_op',
          operator: '+',
          left: { type: 'number', value: 2 },
          right: { type: 'number', value: 3 },
        },
        right: { type: 'number', value: 4 },
      });
    });

    it('should handle nested parentheses', () => {
      const ast = parseFormula('((1 + 2) * 3)');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '*',
        left: {
          type: 'binary_op',
          operator: '+',
          left: { type: 'number', value: 1 },
          right: { type: 'number', value: 2 },
        },
        right: { type: 'number', value: 3 },
      });
    });

    it('should handle multiple parenthesized groups', () => {
      const ast = parseFormula('(STR + DEX) / 2');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '/',
        left: {
          type: 'binary_op',
          operator: '+',
          left: { type: 'variable', value: 'STR' },
          right: { type: 'variable', value: 'DEX' },
        },
        right: { type: 'number', value: 2 },
      });
    });
  });

  describe('Unary Operations', () => {
    it('should parse unary minus', () => {
      const ast = parseFormula('-5');
      expect(ast).toEqual({
        type: 'unary_op',
        operator: 'negate',
        operand: { type: 'number', value: 5 },
      });
    });

    it('should parse unary plus (no effect)', () => {
      const ast = parseFormula('+5');
      expect(ast).toEqual({
        type: 'number',
        value: 5,
      });
    });

    it('should parse unary minus with variable', () => {
      const ast = parseFormula('-STR');
      expect(ast).toEqual({
        type: 'unary_op',
        operator: 'negate',
        operand: { type: 'variable', value: 'STR' },
      });
    });

    it('should parse unary minus in expression', () => {
      const ast = parseFormula('10 + -5');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'number', value: 10 },
        right: {
          type: 'unary_op',
          operator: 'negate',
          operand: { type: 'number', value: 5 },
        },
      });
    });

    it('should parse double negation', () => {
      const ast = parseFormula('--5');
      expect(ast).toEqual({
        type: 'unary_op',
        operator: 'negate',
        operand: {
          type: 'unary_op',
          operator: 'negate',
          operand: { type: 'number', value: 5 },
        },
      });
    });

    it('should parse unary minus with parentheses', () => {
      const ast = parseFormula('-(STR + DEX)');
      expect(ast).toEqual({
        type: 'unary_op',
        operator: 'negate',
        operand: {
          type: 'binary_op',
          operator: '+',
          left: { type: 'variable', value: 'STR' },
          right: { type: 'variable', value: 'DEX' },
        },
      });
    });
  });

  describe('Complex Formulas', () => {
    it('should parse stat formula', () => {
      const ast = parseFormula('STR * 10 + CON * 5');
      expect(ast.type).toBe('binary_op');
    });

    it('should parse speciality skill formula', () => {
      const ast = parseFormula('(STR + DEX) / 2');
      expect(ast.type).toBe('binary_op');
    });

    it('should parse combat skill formula', () => {
      const ast = parseFormula('STR + MEL');
      expect(ast.type).toBe('binary_op');
    });

    it('should parse complex nested formula', () => {
      const ast = parseFormula('((STR + DEX) * 2 + CON) / 3');
      expect(ast.type).toBe('binary_op');
    });

    it('should handle whitespace variations', () => {
      const ast1 = parseFormula('STR+DEX');
      const ast2 = parseFormula('STR + DEX');
      const ast3 = parseFormula('  STR  +  DEX  ');
      
      expect(ast1).toEqual(ast2);
      expect(ast2).toEqual(ast3);
    });
  });

  describe('Error Handling', () => {
    it('should throw on unexpected character', () => {
      expect(() => parseFormula('STR @ DEX')).toThrow(/Unexpected character/);
    });

    it('should throw on mismatched parentheses (missing closing)', () => {
      expect(() => parseFormula('(STR + DEX')).toThrow(/Expected token type RPAREN/);
    });

    it('should throw on mismatched parentheses (extra closing)', () => {
      expect(() => parseFormula('STR + DEX)')).toThrow(/Unexpected token RPAREN/);
    });

    it('should throw on empty formula', () => {
      expect(() => parseFormula('')).toThrow();
    });

    it('should throw on incomplete expression', () => {
      expect(() => parseFormula('STR +')).toThrow();
    });

    it('should parse double plus as unary plus', () => {
      // STR ++ DEX is valid: STR + (+DEX)
      const ast = parseFormula('STR ++ DEX');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'variable', value: 'STR' },
        right: { type: 'variable', value: 'DEX' },
      });
    });

    it('should throw on trailing operator', () => {
      expect(() => parseFormula('STR + DEX *')).toThrow();
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle leading whitespace', () => {
      const ast = parseFormula('   STR + DEX');
      expect(ast.type).toBe('binary_op');
    });

    it('should handle trailing whitespace', () => {
      const ast = parseFormula('STR + DEX   ');
      expect(ast.type).toBe('binary_op');
    });

    it('should handle tabs and newlines', () => {
      const ast = parseFormula('STR\t+\nDEX');
      expect(ast).toEqual({
        type: 'binary_op',
        operator: '+',
        left: { type: 'variable', value: 'STR' },
        right: { type: 'variable', value: 'DEX' },
      });
    });
  });
});
