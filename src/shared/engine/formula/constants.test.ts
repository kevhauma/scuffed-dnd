/**
 * Constants Namespace Tests
 *
 * **Validates: Concept 05; spec §5.1**
 */

import { describe, expect, it } from 'vitest';
import type { Constant } from '../../types/config';
import type { FormulaError } from '../../types/formula';
import { constantsNamespace, namedConstant } from './constants';
import { describeFormulaError, isFormulaError } from './errors';
import { evaluateFormulaString } from './evaluator';

const constants: Constant[] = [
  {
    id: 'id-div',
    name: 'bonus_divider',
    displayName: 'Bonus divider',
    description: 'Levels per point of bonus',
    value: 5,
  },
  {
    id: 'id-apt',
    name: 'apt_value',
    displayName: 'APT value',
    description: 'Speed per attack',
    value: 30,
  },
];

/** Evaluate a formula with only the `const` namespace available */
function evaluate(formula: string, available: Constant[] = constants) {
  return evaluateFormulaString(formula, {
    variables: {},
    namespaces: { const: constantsNamespace(available) },
  });
}

describe('constantsNamespace', () => {
  it('resolves a constant by name', () => {
    expect(evaluate('const.bonus_divider')).toBe(5);
    expect(evaluate('const.apt_value')).toBe(30);
  });

  it('is usable in an expression, alongside the function library', () => {
    expect(evaluate('max(1, round(60 / const.apt_value))')).toBe(2);
  });

  it('reports an unknown constant as a named error rather than zero', () => {
    const result = evaluate('const.nope');

    expect(isFormulaError(result)).toBe(true);
    expect(describeFormulaError(result as FormulaError)).toContain('Unknown member: const.nope');
  });

  it('refuses a property access — a constant is a single number', () => {
    const result = evaluate('const.bonus_divider.value');

    expect(isFormulaError(result)).toBe(true);
    expect(describeFormulaError(result as FormulaError)).toContain('has no property value');
  });

  it('treats no constants as every constant being unknown', () => {
    expect(isFormulaError(evaluate('const.bonus_divider', []))).toBe(true);
  });

  it('reads the value it is given, so retuning changes every dependent', () => {
    const retuned = constants.map((constant) =>
      constant.name === 'bonus_divider' ? { ...constant, value: 4 } : constant
    );

    expect(evaluate('20 / const.bonus_divider')).toBe(4);
    expect(evaluate('20 / const.bonus_divider', retuned)).toBe(5);
  });
  it('lets the first of two duplicate names win, matching the reference index', () => {
    const duplicated: Constant[] = [
      { ...constants[0], id: 'id-first', value: 5 },
      { ...constants[0], id: 'id-second', value: 99 },
    ];

    expect(evaluate('const.bonus_divider', duplicated)).toBe(5);
  });
});

describe('namedConstant', () => {
  const positive = (value: number) => value > 0;

  it('reads the ruleset value when it is usable', () => {
    expect(namedConstant(constants, 'bonus_divider', 5, positive)).toBe(5);
    expect(namedConstant(constants, 'apt_value', 1, positive)).toBe(30);
  });

  it('falls back when the constant is absent, so renaming retunes rather than breaks', () => {
    expect(namedConstant(constants, 'race_blend_divisor', 2, positive)).toBe(2);
    expect(namedConstant(undefined, 'bonus_divider', 5, positive)).toBe(5);
    expect(namedConstant([], 'bonus_divider', 5, positive)).toBe(5);
  });

  it('falls back on a value the caller cannot use', () => {
    const unusable = (value: number): Constant[] => [{ ...constants[0], value }];

    expect(namedConstant(unusable(0), 'bonus_divider', 5, positive)).toBe(5);
    expect(namedConstant(unusable(-3), 'bonus_divider', 5, positive)).toBe(5);
    expect(namedConstant(unusable(Number.NaN), 'bonus_divider', 5, positive)).toBe(5);
    expect(namedConstant(unusable(Number.POSITIVE_INFINITY), 'bonus_divider', 5, positive)).toBe(5);
  });

  it('lets the caller decide what usable means — zero points per level is a ruleset', () => {
    const zeroed: Constant[] = [{ ...constants[0], value: 0 }];

    expect(namedConstant(zeroed, 'bonus_divider', 3, (value) => value >= 0)).toBe(0);
  });

  it('resolves duplicates the way a formula does, not the way a bare find would', () => {
    const duplicated: Constant[] = [
      { ...constants[0], id: 'id-first', value: 7 },
      { ...constants[0], id: 'id-second', value: 99 },
    ];

    expect(namedConstant(duplicated, 'bonus_divider', 5, positive)).toBe(7);
  });
});
