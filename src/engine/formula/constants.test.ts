/**
 * Constants Namespace Tests
 *
 * **Validates: Concept 05; spec §5.1**
 */

import { describe, expect, it } from 'vitest';
import type { Constant } from '../../types/config';
import type { FormulaError } from '../../types/formula';
import { constantsNamespace } from './constants';
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
