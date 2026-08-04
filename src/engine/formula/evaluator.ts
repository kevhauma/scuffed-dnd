/**
 * Formula Evaluator
 *
 * Evaluates Abstract Syntax Trees (AST) with a given context. Handles arithmetic operations with
 * proper precedence through the AST structure, applies the closed function library, and resolves
 * dotted references through the context's namespace resolvers.
 *
 * **Errors are values, not exceptions** (Concept 00 §7). Anything wrong with the *ruleset* — an
 * undefined reference, an unknown function, bad arity, a namespace that isn't there, division by
 * zero — comes back as a `FormulaError` that propagates through the rest of the expression, so
 * one broken formula poisons only its own value. Reading a variable that already holds an error
 * yields an `upstream` error naming it, which is how provenance chains between formulas.
 *
 * Bugs in the *engine* still throw: an unknown AST node type or operator means the parser and
 * evaluator disagree, and no ruleset edit can cause it.
 *
 * Namespaced calls (`curve.cr(x)`) evaluate to a `not-evaluable` error until TICKET-CRV-01 lands
 * curve lookup.
 *
 * **Validates: Requirements 16.1, 16.6, 3.4, 4.4, 5.4; Concepts 00 §5, 00 §7, 01, 02; spec §5.1, §5.3, §5.5**
 */

import type { FormulaAST, FormulaContext, FormulaResult } from '../../types/formula';
import { formulaError, isFormulaError } from './errors';
import { describeArity, FORMULA_FUNCTIONS } from './functions';
import { parseFormula } from './parser';

/**
 * Evaluate a formula AST with the given context
 *
 * @param ast - The Abstract Syntax Tree to evaluate
 * @param context - Variable values and namespace resolvers
 * @returns The calculated number, or a `FormulaError` explaining why there isn't one
 * @throws Error only on a malformed AST — a ruleset problem never throws
 */
export function evaluateFormula(ast: FormulaAST, context: FormulaContext): FormulaResult {
  switch (ast.type) {
    case 'number':
      return ast.value;

    case 'variable':
      return evaluateVariable(ast.value, context);

    case 'binary_op': {
      const left = evaluateFormula(ast.left, context);
      if (isFormulaError(left)) return left;

      const right = evaluateFormula(ast.right, context);
      if (isFormulaError(right)) return right;

      switch (ast.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right === 0 ? formulaError('division-by-zero', 'Division by zero') : left / right;
        default:
          // Parser and evaluator disagree about the operator set — an engine bug
          throw new Error(`Unknown binary operator: ${ast.operator}`);
      }
    }

    case 'unary_op': {
      const operand = evaluateFormula(ast.operand, context);
      if (isFormulaError(operand)) return operand;

      switch (ast.operator) {
        case 'negate':
          return -operand;
        default:
          // Parser and evaluator disagree about the operator set — an engine bug
          throw new Error(`Unknown unary operator: ${ast.operator}`);
      }
    }

    case 'function_call':
      return evaluateCall(ast.name, ast.args, context);

    case 'namespaced_ref':
      return evaluateNamespacedRef(ast.namespace, ast.member, context, ast.property);

    case 'namespaced_call':
      return formulaError(
        'not-evaluable',
        `${ast.namespace}.${ast.member}(…) cannot be evaluated yet — curve lookups arrive with TICKET-CRV-01`
      );

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = ast;
      throw new Error(`Unknown AST node type: ${(_exhaustive as FormulaAST).type}`);
    }
  }
}

/**
 * Parse and evaluate a formula string in one step
 *
 * The entry point calculators use: a syntax error becomes an error **value** here rather than an
 * exception, so a ruleset with one unparseable formula still calculates everything else.
 *
 * @param formula - Formula source text
 * @param context - Variable values and namespace resolvers
 * @returns The calculated number, or a `FormulaError`
 */
export function evaluateFormulaString(formula: string, context: FormulaContext): FormulaResult {
  let ast: FormulaAST;
  try {
    ast = parseFormula(formula);
  } catch (error) {
    return formulaError('syntax', error instanceof Error ? error.message : 'Invalid formula');
  }

  return evaluateFormula(ast, context);
}

/**
 * Look up a legacy bare code, chaining provenance when it already holds an error
 */
function evaluateVariable(name: string, context: FormulaContext): FormulaResult {
  const value = context.variables[name];

  if (value === undefined) {
    return formulaError('undefined-variable', `Undefined variable: ${name}`);
  }

  if (isFormulaError(value)) {
    return formulaError('upstream', `${name} could not be calculated`, { cause: value });
  }

  return value;
}

/**
 * Apply a library function, propagating the first errored argument
 */
function evaluateCall(name: string, args: FormulaAST[], context: FormulaContext): FormulaResult {
  const fn = FORMULA_FUNCTIONS[name];
  if (!fn) {
    return formulaError('unknown-function', `Unknown function: ${name}`);
  }

  if (args.length < fn.minArgs || (fn.maxArgs !== null && args.length > fn.maxArgs)) {
    return formulaError('wrong-arity', `${name} expects ${describeArity(fn)}, got ${args.length}`);
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = evaluateFormula(arg, context);
    if (isFormulaError(value)) return value;
    values.push(value);
  }

  return fn.apply(values);
}

/**
 * Resolve a dotted reference, chaining provenance when the resolved value is itself an error
 */
function evaluateNamespacedRef(
  namespace: string,
  member: string,
  context: FormulaContext,
  property?: string
): FormulaResult {
  const path = property ? `${namespace}.${member}.${property}` : `${namespace}.${member}`;

  const resolver = context.namespaces?.[namespace];
  if (!resolver) {
    return formulaError('unknown-namespace', `Unknown namespace: ${namespace}`);
  }

  const value = resolver.resolve(member, property);
  if (value === undefined) {
    return formulaError('unknown-member', `Unknown member: ${path}`);
  }

  if (isFormulaError(value)) {
    return formulaError('upstream', `${path} could not be calculated`, { cause: value });
  }

  return value;
}
