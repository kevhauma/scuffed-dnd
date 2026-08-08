/**
 * Formula Parser Tests
 */

import { describe, expect, it } from 'vitest';
import { parseFormula, tokenizeFormula } from './parser';

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

describe('Function calls (TICKET-FORM-02)', () => {
  it('should parse a simple call', () => {
    const ast = parseFormula('round(STR)');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'round',
      args: [{ type: 'variable', value: 'STR' }],
    });
  });

  it('should parse nested calls', () => {
    const ast = parseFormula('max(1, round(SPD / 30))');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'max',
      args: [
        { type: 'number', value: 1 },
        {
          type: 'function_call',
          name: 'round',
          args: [
            {
              type: 'binary_op',
              operator: '/',
              left: { type: 'variable', value: 'SPD' },
              right: { type: 'number', value: 30 },
            },
          ],
        },
      ],
    });
  });

  it('should bind calls tighter than surrounding operators', () => {
    // 1 + max(2, 3) * 2 must parse as 1 + (max(2, 3) * 2)
    const ast = parseFormula('1 + max(2, 3) * 2');
    expect(ast).toEqual({
      type: 'binary_op',
      operator: '+',
      left: { type: 'number', value: 1 },
      right: {
        type: 'binary_op',
        operator: '*',
        left: {
          type: 'function_call',
          name: 'max',
          args: [
            { type: 'number', value: 2 },
            { type: 'number', value: 3 },
          ],
        },
        right: { type: 'number', value: 2 },
      },
    });
  });

  it('should parse expressions as arguments', () => {
    const ast = parseFormula('clamp(STR + 1, 0, 10)');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'clamp',
      args: [
        {
          type: 'binary_op',
          operator: '+',
          left: { type: 'variable', value: 'STR' },
          right: { type: 'number', value: 1 },
        },
        { type: 'number', value: 0 },
        { type: 'number', value: 10 },
      ],
    });
  });

  it('should parse an empty argument list (arity is a validation concern)', () => {
    const ast = parseFormula('round()');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'round',
      args: [],
    });
  });

  it('should keep the function name case as written (case-sensitive library)', () => {
    const ast = parseFormula('ROUND(1)');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'ROUND',
      args: [{ type: 'number', value: 1 }],
    });
  });

  it('should parse unknown names as calls (unknown-name is a validation concern)', () => {
    const ast = parseFormula('foo(1)');
    expect(ast).toEqual({
      type: 'function_call',
      name: 'foo',
      args: [{ type: 'number', value: 1 }],
    });
  });

  it('should still parse a lowercase identifier without parens as a variable', () => {
    const ast = parseFormula('round + 1');
    expect(ast).toEqual({
      type: 'binary_op',
      operator: '+',
      left: { type: 'variable', value: 'ROUND' },
      right: { type: 'number', value: 1 },
    });
  });

  it('should reject a bare comma outside a call', () => {
    expect(() => parseFormula('1, 2')).toThrow();
  });

  it('should reject an unterminated call', () => {
    expect(() => parseFormula('max(1, 2')).toThrow();
  });
});

describe('Namespaced references (TICKET-FORM-03)', () => {
  it('should parse a two-segment reference', () => {
    const ast = parseFormula('stats.speed');
    expect(ast).toEqual({
      type: 'namespaced_ref',
      namespace: 'stats',
      member: 'speed',
    });
  });

  it('should parse a property access as the third segment', () => {
    const ast = parseFormula('skills.healing.level');
    expect(ast).toEqual({
      type: 'namespaced_ref',
      namespace: 'skills',
      member: 'healing',
      property: 'level',
    });
  });

  it('should allow underscores and digits in members', () => {
    const ast = parseFormula('const.bonus_divider2');
    expect(ast).toEqual({
      type: 'namespaced_ref',
      namespace: 'const',
      member: 'bonus_divider2',
    });
  });

  it('should parse namespaced references inside expressions', () => {
    const ast = parseFormula('stats.str * 2 + const.base');
    expect(ast).toEqual({
      type: 'binary_op',
      operator: '+',
      left: {
        type: 'binary_op',
        operator: '*',
        left: { type: 'namespaced_ref', namespace: 'stats', member: 'str' },
        right: { type: 'number', value: 2 },
      },
      right: { type: 'namespaced_ref', namespace: 'const', member: 'base' },
    });
  });

  it('should parse a namespaced call', () => {
    const ast = parseFormula('curve.cr(STR)');
    expect(ast).toEqual({
      type: 'namespaced_call',
      namespace: 'curve',
      member: 'cr',
      args: [{ type: 'variable', value: 'STR' }],
    });
  });

  it('should parse a namespaced call that selects a column (TICKET-CRV-01)', () => {
    const ast = parseFormula('curve.point_buy.main_type(3)');
    expect(ast).toEqual({
      type: 'namespaced_call',
      namespace: 'curve',
      member: 'point_buy',
      property: 'main_type',
      args: [{ type: 'number', value: 3 }],
    });
  });

  it('should still parse three segments without parentheses as a property access', () => {
    const ast = parseFormula('skills.healing.level');
    expect(ast).toEqual({
      type: 'namespaced_ref',
      namespace: 'skills',
      member: 'healing',
      property: 'level',
    });
  });

  it('should parse a column-selecting call on a persisted id reference', () => {
    const ast = parseFormula('curve.[id-pb].main_type(3)');
    expect(ast).toEqual({
      type: 'namespaced_call',
      namespace: 'curve',
      member: 'id-pb',
      property: 'main_type',
      args: [{ type: 'number', value: 3 }],
    });
  });

  it('should parse expression arguments in a namespaced call', () => {
    const ast = parseFormula('curve.cr(stats.total + 1)');
    expect(ast).toEqual({
      type: 'namespaced_call',
      namespace: 'curve',
      member: 'cr',
      args: [
        {
          type: 'binary_op',
          operator: '+',
          left: { type: 'namespaced_ref', namespace: 'stats', member: 'total' },
          right: { type: 'number', value: 1 },
        },
      ],
    });
  });

  it('should keep segment case as written (namespaces resolve case-sensitively)', () => {
    const ast = parseFormula('STATS.SPD');
    expect(ast).toEqual({
      type: 'namespaced_ref',
      namespace: 'STATS',
      member: 'SPD',
    });
  });

  it('should mix legacy bare codes and namespaced references', () => {
    const ast = parseFormula('STR + stats.speed');
    expect(ast).toEqual({
      type: 'binary_op',
      operator: '+',
      left: { type: 'variable', value: 'STR' },
      right: { type: 'namespaced_ref', namespace: 'stats', member: 'speed' },
    });
  });

  it('should reject a trailing dot', () => {
    expect(() => parseFormula('stats.')).toThrow();
  });

  it('should reject a fourth segment', () => {
    expect(() => parseFormula('a.b.c.d')).toThrow();
  });

  it('should reject a dot before a number segment', () => {
    expect(() => parseFormula('stats.2')).toThrow();
  });

  it('should take digits and underscores into a bare identifier', () => {
    // Widened from letters-only so `const.bonus_divider` tokenizes; the legacy bare path
    // widens with it, so `STR2` is now one variable rather than a tokenizer error.
    expect(parseFormula('STR2')).toEqual({ type: 'variable', value: 'STR2' });
    expect(parseFormula('bonus_divider')).toEqual({
      type: 'variable',
      value: 'BONUS_DIVIDER',
    });
  });
});

describe('Id references (TICKET-REF-01)', () => {
  it('should parse a bracketed id as a bare variable, case intact', () => {
    expect(parseFormula('[a1B2-c3]')).toEqual({ type: 'variable', value: 'a1B2-c3' });
  });

  it('should parse a bracketed id as a namespace member', () => {
    expect(parseFormula('stats.[550e8400-e29b-41d4]')).toEqual({
      type: 'namespaced_ref',
      namespace: 'stats',
      member: '550e8400-e29b-41d4',
    });
  });

  it('should keep a property segment after a bracketed member', () => {
    expect(parseFormula('skills.[id-stl].level')).toEqual({
      type: 'namespaced_ref',
      namespace: 'skills',
      member: 'id-stl',
      property: 'level',
    });
  });

  it('should parse id references inside an expression', () => {
    expect(parseFormula('[id-str] * 10')).toEqual({
      type: 'binary_op',
      operator: '*',
      left: { type: 'variable', value: 'id-str' },
      right: { type: 'number', value: 10 },
    });
  });

  it('should reject an empty or unterminated id reference', () => {
    expect(() => parseFormula('[]')).toThrow('Empty id reference');
    expect(() => parseFormula('[abc')).toThrow('Unterminated id reference');
  });
});

describe('tokenizeFormula (TICKET-REF-01)', () => {
  it('reports each token with the span it occupies in the source', () => {
    const tokens = tokenizeFormula(' STR + 2');

    expect(tokens.map((t) => [t.type, t.value, t.position, t.end])).toEqual([
      ['IDENTIFIER', 'STR', 1, 4],
      ['PLUS', '+', 5, 6],
      ['NUMBER', 2, 7, 8],
      ['EOF', '', 8, 8],
    ]);
  });
});

describe('Exponentiation (TICKET-FORM-07)', () => {
  it('should parse a power as a binary operation', () => {
    expect(parseFormula('2 ^ 3')).toEqual({
      type: 'binary_op',
      operator: '^',
      left: { type: 'number', value: 2 },
      right: { type: 'number', value: 3 },
    });
  });

  it('should bind tighter than multiplication', () => {
    // 2 * (3 ^ 2), not (2 * 3) ^ 2
    expect(parseFormula('2 * 3 ^ 2')).toEqual({
      type: 'binary_op',
      operator: '*',
      left: { type: 'number', value: 2 },
      right: {
        type: 'binary_op',
        operator: '^',
        left: { type: 'number', value: 3 },
        right: { type: 'number', value: 2 },
      },
    });
  });

  it('should bind tighter than addition', () => {
    expect(parseFormula('1 + 2 ^ 3')).toMatchObject({
      operator: '+',
      right: { operator: '^' },
    });
  });

  it('should be right-associative', () => {
    // 2 ^ (3 ^ 2) = 512, not (2 ^ 3) ^ 2 = 64
    expect(parseFormula('2 ^ 3 ^ 2')).toEqual({
      type: 'binary_op',
      operator: '^',
      left: { type: 'number', value: 2 },
      right: {
        type: 'binary_op',
        operator: '^',
        left: { type: 'number', value: 3 },
        right: { type: 'number', value: 2 },
      },
    });
  });

  it('should let unary minus bind tighter, as a spreadsheet does', () => {
    // (-2) ^ 2, which is Excel's reading — see the ticket's decision note
    expect(parseFormula('-2 ^ 2')).toEqual({
      type: 'binary_op',
      operator: '^',
      left: { type: 'unary_op', operator: 'negate', operand: { type: 'number', value: 2 } },
      right: { type: 'number', value: 2 },
    });
  });

  it('should accept a negative exponent', () => {
    expect(parseFormula('2 ^ -3')).toEqual({
      type: 'binary_op',
      operator: '^',
      left: { type: 'number', value: 2 },
      right: { type: 'unary_op', operator: 'negate', operand: { type: 'number', value: 3 } },
    });
  });

  it('should take references and calls as operands', () => {
    expect(parseFormula('const.base ^ STR')).toMatchObject({
      operator: '^',
      left: { type: 'namespaced_ref', namespace: 'const', member: 'base' },
      right: { type: 'variable', value: 'STR' },
    });
  });

  it('should let parentheses override the associativity', () => {
    expect(parseFormula('(2 ^ 3) ^ 2')).toMatchObject({
      operator: '^',
      left: { operator: '^' },
      right: { type: 'number', value: 2 },
    });
  });
});
