/**
 * Formula Error Value Tests
 *
 * **Validates: Concept 00 §7; spec §5.5; Requirement 16.6**
 */

import { describe, expect, it } from 'vitest';
import type { FormulaContext } from '../../types/formula';
import {
  asNumber,
  describeFormulaError,
  formulaError,
  isFormulaError,
  numberOr,
  rootCause,
  withSource,
} from './errors';
import { evaluateFormula, evaluateFormulaString } from './evaluator';
import { parseFormula } from './parser';

const empty: FormulaContext = { variables: {} };

describe('error values per data-error kind (TICKET-FORM-05)', () => {
  const cases: Array<{ kind: string; formula: string; context?: FormulaContext }> = [
    { kind: 'syntax', formula: 'STR * * 2' },
    { kind: 'undefined-variable', formula: 'STR' },
    { kind: 'unknown-function', formula: 'wibble(1)' },
    { kind: 'wrong-arity', formula: 'clamp(1, 2)' },
    { kind: 'unknown-namespace', formula: 'nope.thing' },
    { kind: 'unknown-member', formula: 'stats.nope', context: withStatsNamespace() },
    { kind: 'division-by-zero', formula: '1 / 0' },
    { kind: 'not-evaluable', formula: 'curve.cr(1)' },
  ];

  for (const { kind, formula, context } of cases) {
    it(`returns a ${kind} error rather than throwing`, () => {
      let result: ReturnType<typeof evaluateFormulaString> | undefined;

      expect(() => {
        result = evaluateFormulaString(formula, context ?? empty);
      }).not.toThrow();

      expect(isFormulaError(result)).toBe(true);
      expect(result).toMatchObject({ kind });
    });
  }
});

describe('programmer errors still throw (TICKET-FORM-05)', () => {
  it('throws on an AST node the evaluator does not know', () => {
    // Not reachable from the parser — this is the engine disagreeing with itself
    const malformed = { type: 'wormhole' } as never;

    expect(() => evaluateFormula(malformed, empty)).toThrow(/Unknown AST node type/);
  });

  it('throws on a binary operator the evaluator does not know', () => {
    const malformed = {
      type: 'binary_op',
      operator: '%',
      left: { type: 'number', value: 1 },
      right: { type: 'number', value: 2 },
    } as never;

    expect(() => evaluateFormula(malformed, empty)).toThrow(/Unknown binary operator/);
  });

  it('throws on a unary operator the evaluator does not know', () => {
    const malformed = {
      type: 'unary_op',
      operator: 'square',
      operand: { type: 'number', value: 2 },
    } as never;

    expect(() => evaluateFormula(malformed, empty)).toThrow(/Unknown unary operator/);
  });
});

describe('error propagation within one formula', () => {
  it('propagates through arithmetic without wrapping', () => {
    const result = evaluateFormulaString('MISSING + 1 * 2', empty);
    expect(result).toMatchObject({ kind: 'undefined-variable' });
  });

  it('propagates out of a function argument', () => {
    const result = evaluateFormulaString('max(1, MISSING)', empty);
    expect(result).toMatchObject({ kind: 'undefined-variable' });
  });

  it('returns the first error when several are present', () => {
    const result = evaluateFormulaString('MISSING + ALSOMISSING', empty);
    expect(result).toMatchObject({ message: 'Undefined variable: MISSING' });
  });
});

describe('provenance chains across formulas', () => {
  it('names the upstream cause when a variable already holds an error', () => {
    // Formula B failed; formula A reads B's value
    const bFailed = withSource(formulaError('undefined-variable', 'Undefined variable: MAG'), {
      kind: 'stat',
      id: 'mana',
      name: 'Mana',
    });

    const result = evaluateFormula(parseFormula('MANA * 2'), {
      variables: { MANA: bFailed },
    });

    expect(result).toMatchObject({
      kind: 'upstream',
      message: 'MANA could not be calculated',
      cause: { message: 'Undefined variable: MAG', source: { name: 'Mana' } },
    });
  });

  it('names the upstream cause through a namespaced reference', () => {
    const broken = formulaError('undefined-variable', 'Undefined variable: MAG');

    const result = evaluateFormula(parseFormula('stats.mana + 1'), {
      variables: {},
      namespaces: { stats: { resolve: () => broken } },
    });

    expect(result).toMatchObject({
      kind: 'upstream',
      message: 'stats.mana could not be calculated',
      cause: { message: 'Undefined variable: MAG' },
    });
  });

  it('renders a chain root-cause last', () => {
    const root = withSource(formulaError('undefined-variable', 'Undefined variable: MAG'), {
      kind: 'stat',
      id: 'mana',
      name: 'Mana',
    });
    const middle = formulaError('upstream', 'MANA could not be calculated', { cause: root });
    const outer = withSource(
      formulaError('upstream', 'POWER could not be calculated', { cause: middle }),
      { kind: 'combat-skill', id: 'MEL', name: 'Melee' }
    );

    expect(describeFormulaError(outer)).toBe(
      'Combat Skill "Melee": POWER could not be calculated ← MANA could not be calculated ← Stat "Mana": Undefined variable: MAG'
    );
  });

  it('finds the root cause of a chain', () => {
    const root = formulaError('undefined-variable', 'Undefined variable: MAG');
    const chained = formulaError('upstream', 'A could not be calculated', {
      cause: formulaError('upstream', 'B could not be calculated', { cause: root }),
    });

    expect(rootCause(chained)).toBe(root);
  });
});

describe('accessors', () => {
  it('asNumber returns the number and undefined for errors or absence', () => {
    expect(asNumber(7)).toBe(7);
    expect(asNumber(formulaError('syntax', 'bad'))).toBeUndefined();
    expect(asNumber(undefined)).toBeUndefined();
  });

  it('numberOr falls back for errors and absence but not for zero', () => {
    expect(numberOr(0, 99)).toBe(0);
    expect(numberOr(formulaError('syntax', 'bad'), 99)).toBe(99);
    expect(numberOr(undefined, 99)).toBe(99);
  });

  it('isFormulaError does not mistake a number for an error', () => {
    expect(isFormulaError(0)).toBe(false);
    expect(isFormulaError(null)).toBe(false);
    expect(isFormulaError(undefined)).toBe(false);
  });

  it('isFormulaError checks the brand value, not just the key', () => {
    // A resolver is a public extension point; an object merely carrying the key is not an error
    expect(isFormulaError({ formulaError: false })).toBe(false);
    expect(isFormulaError({ formulaError: 'yes' })).toBe(false);
    expect(isFormulaError(formulaError('syntax', 'bad'))).toBe(true);
  });

  it('withSource keeps the innermost source rather than overwriting it', () => {
    const original = withSource(formulaError('syntax', 'bad'), {
      kind: 'stat',
      id: 'mana',
      name: 'Mana',
    });

    const relabelled = withSource(original, { kind: 'combat-skill', id: 'MEL', name: 'Melee' });

    expect(relabelled.source).toEqual({ kind: 'stat', id: 'mana', name: 'Mana' });
  });
});

/** A context whose `stats` namespace resolves nothing, for the unknown-member case */
function withStatsNamespace(): FormulaContext {
  return { variables: {}, namespaces: { stats: { resolve: () => undefined } } };
}
