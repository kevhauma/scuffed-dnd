/**
 * Formula Evaluator Tests
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FormulaContext, FormulaResult, NamespaceResolver } from '../../types/formula';
import { isFormulaError } from './errors';
import { evaluateFormula, evaluateFormulaString } from './evaluator';
import { parseFormula } from './parser';

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

    it('should return an error value for undefined variable (contract changed by TICKET-FORM-05)', () => {
      const ast = parseFormula('STR');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toMatchObject({
        kind: 'undefined-variable',
        message: 'Undefined variable: STR',
      });
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

    it('should return an error value on division by zero (contract changed by TICKET-FORM-05)', () => {
      const ast = parseFormula('10 / 0');
      const context: FormulaContext = { variables: {} };
      expect(evaluateFormula(ast, context)).toMatchObject({
        kind: 'division-by-zero',
        message: 'Division by zero',
      });
    });

    it('should return an error value on division by zero variable', () => {
      const ast = parseFormula('STR / DEX');
      const context: FormulaContext = { variables: { STR: 10, DEX: 0 } };
      expect(evaluateFormula(ast, context)).toMatchObject({ kind: 'division-by-zero' });
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

describe('Function calls (TICKET-FORM-02)', () => {
  const empty: FormulaContext = { variables: {} };

  const evaluate = (formula: string, context: FormulaContext = empty): FormulaResult =>
    evaluateFormula(parseFormula(formula), context);

  describe('round — half away from zero (Excel semantics)', () => {
    it('round(1.5) = 2', () => {
      expect(evaluate('round(1.5)')).toBe(2);
    });

    it('round(2.5) = 3', () => {
      expect(evaluate('round(2.5)')).toBe(3);
    });

    it('round(7.5 / 5) = 2', () => {
      expect(evaluate('round(7.5 / 5)')).toBe(2);
    });

    it('round(-0.5) = -1', () => {
      expect(evaluate('round(-0.5)')).toBe(-1);
    });

    it('round(-1.5) = -2', () => {
      expect(evaluate('round(-1.5)')).toBe(-2);
    });

    it('round(0.4) = 0 and round(0) = 0', () => {
      expect(evaluate('round(0.4)')).toBe(0);
      expect(evaluate('round(0)')).toBe(0);
    });
  });

  describe('roundup / rounddown — away from / toward zero', () => {
    it('roundup(1.2) = 2', () => {
      expect(evaluate('roundup(1.2)')).toBe(2);
    });

    it('roundup(-1.2) = -2 (away from zero)', () => {
      expect(evaluate('roundup(-1.2)')).toBe(-2);
    });

    it('roundup(0.2 * 12 + 0.1 * 6) = 3 — binary noise is settled, as Excel settles it', () => {
      // The sum is 3.0000000000000004 as a double, so an unsettled round-up answers 4 where the
      // workbook answers 3. It is pinned *here*, through a User formula, because that is the half of
      // the promise a test could otherwise miss: `skillCalculator` rounds a skill level through this
      // same function (TICKET-SKL-04), and a settle living only in the calculator would leave a
      // formula spelling the identical arithmetic disagreeing with the sheet it sits on.
      expect(evaluate('roundup(0.2 * 12 + 0.1 * 6)')).toBe(3);
    });

    it('rounddown(1.8) = 1', () => {
      expect(evaluate('rounddown(1.8)')).toBe(1);
    });

    it('rounddown(-1.8) = -1 (toward zero)', () => {
      expect(evaluate('rounddown(-1.8)')).toBe(-1);
    });
  });

  describe('floor / ceil', () => {
    it('floor(-1.5) = -2', () => {
      expect(evaluate('floor(-1.5)')).toBe(-2);
    });

    it('ceil(-1.5) = -1', () => {
      expect(evaluate('ceil(-1.5)')).toBe(-1);
    });
  });

  describe('variadic min / max', () => {
    it('accepts a single argument', () => {
      expect(evaluate('max(3)')).toBe(3);
      expect(evaluate('min(3)')).toBe(3);
    });

    it('takes the extreme of many arguments', () => {
      expect(evaluate('max(1, 5, 3)')).toBe(5);
      expect(evaluate('min(4, 2, 8)')).toBe(2);
    });
  });

  describe('clamp boundaries', () => {
    it('passes a value inside the range through', () => {
      expect(evaluate('clamp(5, 0, 10)')).toBe(5);
    });

    it('clamps below and above', () => {
      expect(evaluate('clamp(-1, 0, 10)')).toBe(0);
      expect(evaluate('clamp(11, 0, 10)')).toBe(10);
    });

    it('keeps exact boundary values', () => {
      expect(evaluate('clamp(0, 0, 10)')).toBe(0);
      expect(evaluate('clamp(10, 0, 10)')).toBe(10);
    });
  });

  describe('abs', () => {
    it('abs(-3) = 3', () => {
      expect(evaluate('abs(-3)')).toBe(3);
    });
  });

  describe('composition', () => {
    it('evaluates the sheet APT derivation max(1, round(SPD / 30))', () => {
      expect(evaluate('max(1, round(SPD / 30))', { variables: { SPD: 45 } })).toBe(2);
      expect(evaluate('max(1, round(SPD / 30))', { variables: { SPD: 10 } })).toBe(1);
    });

    it('evaluates calls with operator precedence: 1 + max(2, 3) * 2 = 7', () => {
      expect(evaluate('1 + max(2, 3) * 2')).toBe(7);
    });
  });

  describe('errors (values since TICKET-FORM-05, previously throws)', () => {
    it('reports an unknown function', () => {
      expect(evaluate('foo(1)')).toMatchObject({
        kind: 'unknown-function',
        message: 'Unknown function: foo',
      });
    });

    it('reports wrong arity', () => {
      expect(evaluate('round(1, 2)')).toMatchObject({ kind: 'wrong-arity' });
      expect(evaluate('clamp(1, 2)')).toMatchObject({ kind: 'wrong-arity' });
    });

    it('propagates division by zero out of an argument', () => {
      expect(evaluate('round(1 / 0)')).toMatchObject({ kind: 'division-by-zero' });
    });

    it('propagates an undefined variable out of an argument', () => {
      expect(evaluate('round(XYZ)')).toMatchObject({
        kind: 'undefined-variable',
        message: 'Undefined variable: XYZ',
      });
    });
  });
});

describe('Namespaced references (TICKET-FORM-03)', () => {
  /** Build a resolver over a plain lookup table keyed `member` or `member.property` */
  const tableResolver = (table: Record<string, number>) => ({
    resolve: (member: string, property?: string): number | undefined =>
      table[property ? `${member}.${property}` : member],
  });

  const context: FormulaContext = {
    variables: { STR: 7 },
    namespaces: {
      stats: tableResolver({ speed: 45, str: 10 }),
      skills: tableResolver({ 'healing.level': 12, 'healing.bonus': 2 }),
      const: tableResolver({ bonus_divider: 5, base: 3 }),
    },
  };

  const evaluate = (formula: string, ctx: FormulaContext = context): FormulaResult =>
    evaluateFormula(parseFormula(formula), ctx);

  it('resolves each namespace', () => {
    expect(evaluate('stats.speed')).toBe(45);
    expect(evaluate('const.bonus_divider')).toBe(5);
    expect(evaluate('skills.healing.level')).toBe(12);
  });

  it('resolves a property access distinctly from its sibling', () => {
    expect(evaluate('skills.healing.bonus')).toBe(2);
  });

  it('evaluates namespaced references inside expressions', () => {
    expect(evaluate('stats.str * 2 + const.base')).toBe(23);
  });

  it('evaluates namespaced references through the function library', () => {
    expect(evaluate('max(1, round(stats.speed / 30))')).toBe(2);
    expect(evaluate('round(skills.healing.level / const.bonus_divider)')).toBe(2);
  });

  it('mixes legacy bare codes with namespaced references', () => {
    expect(evaluate('STR + stats.speed')).toBe(52);
  });

  it('reports an unknown member distinctly from an undefined variable', () => {
    expect(evaluate('stats.nope')).toMatchObject({
      kind: 'unknown-member',
      message: 'Unknown member: stats.nope',
    });
    expect(evaluate('XYZ')).toMatchObject({
      kind: 'undefined-variable',
      message: 'Undefined variable: XYZ',
    });
  });

  it('reports an unknown property on a known member', () => {
    expect(evaluate('skills.healing.missing')).toMatchObject({
      kind: 'unknown-member',
      message: 'Unknown member: skills.healing.missing',
    });
  });

  it('reports an unknown namespace', () => {
    expect(evaluate('nope.thing')).toMatchObject({
      kind: 'unknown-namespace',
      message: 'Unknown namespace: nope',
    });
  });

  it('reports a missing namespaces map as an unknown namespace', () => {
    expect(evaluate('stats.speed', { variables: {} })).toMatchObject({
      kind: 'unknown-namespace',
      message: 'Unknown namespace: stats',
    });
  });

  it('matches namespaces case-sensitively', () => {
    expect(evaluate('STATS.speed')).toMatchObject({
      kind: 'unknown-namespace',
      message: 'Unknown namespace: STATS',
    });
  });

  it('reports a call into a namespace that is not in the context', () => {
    expect(evaluate('curve.cr(1)')).toMatchObject({
      kind: 'unknown-namespace',
      message: 'Unknown namespace: curve',
    });
  });

  it('hands a call to the namespace resolver, arguments already evaluated (TICKET-CRV-01)', () => {
    const doubler: NamespaceResolver = {
      resolve: () => undefined,
      call: (member, args) => (member === 'twice' ? args[0] * 2 : undefined),
    };

    const context: FormulaContext = { variables: { STR: 4 }, namespaces: { fn: doubler } };

    expect(evaluateFormulaString('fn.twice(STR + 1)', context)).toBe(10);
    expect(evaluateFormulaString('fn.nope(1)', context)).toMatchObject({
      kind: 'unknown-member',
      message: 'Unknown member: fn.nope',
    });
  });
});

describe('Exponentiation (TICKET-FORM-07)', () => {
  const empty: FormulaContext = { variables: {} };

  function evaluatePower(formula: string, context: FormulaContext = empty) {
    return evaluateFormulaString(formula, context);
  }

  it('should raise a number to a power', () => {
    expect(evaluatePower('2 ^ 10')).toBe(1024);
    expect(evaluatePower('9 ^ 0.5')).toBe(3);
    expect(evaluatePower('2 ^ -2')).toBe(0.25);
    expect(evaluatePower('5 ^ 0')).toBe(1);
  });

  it('should evaluate the associativity the parser gives it', () => {
    expect(evaluatePower('2 ^ 3 ^ 2')).toBe(512);
    expect(evaluatePower('(2 ^ 3) ^ 2')).toBe(64);
  });

  it('should evaluate the precedence the parser gives it', () => {
    expect(evaluatePower('2 * 3 ^ 2')).toBe(18);
    expect(evaluatePower('1 + 2 ^ 3')).toBe(9);
    // Excel's reading of unary minus — the ticket's decision note
    expect(evaluatePower('-2 ^ 2')).toBe(4);
  });

  it('should refuse a negative base under a fractional power', () => {
    const result = evaluatePower('-8 ^ 0.5');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('not-evaluable');
    expect(result.message).toContain('no real value');
  });

  it('should refuse zero under a negative power as the division by zero it is', () => {
    const result = evaluatePower('0 ^ -1');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('division-by-zero');
  });

  it('should refuse a result too large to represent', () => {
    const result = evaluatePower('10 ^ 400');

    expect(isFormulaError(result)).toBe(true);
    if (!isFormulaError(result)) return;
    expect(result.kind).toBe('not-evaluable');
    expect(result.message).toContain('too large');
  });

  it('should let a refusal propagate through the rest of the expression', () => {
    // Never a NaN or an Infinity reaching a character sheet (Concept 00 §7)
    const result = evaluatePower('0 ^ -1 + 5');

    expect(isFormulaError(result)).toBe(true);
  });

  it('should propagate an errored operand without computing', () => {
    const result = evaluatePower('STR ^ 2');

    expect(isFormulaError(result)).toBe(true);
    if (isFormulaError(result)) expect(result.kind).toBe('undefined-variable');
  });
});

describe('no arithmetic result escapes as NaN or Infinity (TICKET-FORM-07)', () => {
  const empty: FormulaContext = { variables: {} };

  /** The overflow cases that live one operator past the `^` guard */
  const escapes = [
    '10 ^ 200 * 10 ^ 200',
    '10 ^ 200 * 10 ^ 200 - 10 ^ 200 * 10 ^ 200',
    '10 ^ 200 * 10 ^ 200 * 0',
    '10 ^ 200 * 10 ^ 200 + 1',
    '10 ^ 200 / (10 ^ -200)',
    'round(10 ^ 200 * 10 ^ 200)',
  ];

  for (const formula of escapes) {
    it(`should refuse \`${formula}\` rather than answering with a non-number`, () => {
      const result = evaluateFormulaString(formula, empty);

      expect(isFormulaError(result)).toBe(true);
    });
  }

  it('should hold the invariant for any expression the grammar can build', () => {
    // The property the example cases above are instances of: whatever arithmetic a User writes,
    // the answer is a number they can use or an error they can read — never NaN, never Infinity.
    const operand = fc.oneof(
      fc.double({ min: -1e12, max: 1e12, noNaN: true }),
      fc.constantFrom(0, 1, -1, 1e308, -1e308, 1e-308)
    );
    const operator = fc.constantFrom('+', '-', '*', '/', '^');

    const expression: fc.Arbitrary<string> = fc.letrec<{ node: string }>((tie) => ({
      node: fc.oneof(
        { depthSize: 'small' },
        operand.map((value) => `(${value})`),
        fc.tuple(tie('node'), operator, tie('node')).map(([l, op, r]) => `(${l} ${op} ${r})`)
      ),
    })).node;

    fc.assert(
      fc.property(expression, (formula) => {
        const result = evaluateFormulaString(formula, empty);

        if (isFormulaError(result)) return true;
        return Number.isFinite(result);
      }),
      { numRuns: 500 }
    );
  });
});
