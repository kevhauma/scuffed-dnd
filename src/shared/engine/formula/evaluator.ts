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
 * **No arithmetic result leaves here as `NaN` or `Infinity`.** Every operator and every library
 * call goes through `finite`, because both are `number`s to the type system and would otherwise
 * reach a character sheet unchallenged. `^` made that reachable in one expression, but it is not
 * exponentiation's problem alone — `10 ^ 200 * 10 ^ 200` overflows on the multiply.
 *
 * Namespaced calls (`curve.cr(x)`) go through the namespace resolver's optional `call`, so the
 * evaluator stays ignorant of what a curve is — it evaluates the arguments, propagates the first
 * error among them, and hands over numbers.
 *
 * **Validates: Requirements 16.1, 16.6, 3.4, 4.4, 5.4; Concepts 00 §5, 00 §7, 01, 02; spec §5.1, §5.3, §5.5**
 */

import type {
  BinaryOpNode,
  FormulaAST,
  FormulaContext,
  FormulaResult,
  UnaryOpNode,
} from '../../types/formula';
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

      return applyBinary(ast.operator, left, right);
    }

    case 'unary_op': {
      const operand = evaluateFormula(ast.operand, context);
      if (isFormulaError(operand)) return operand;

      return applyUnary(ast.operator, operand);
    }

    case 'function_call':
      return evaluateCall(ast.name, ast.args, context);

    case 'namespaced_ref':
      return evaluateNamespacedRef(ast.namespace, ast.member, context, ast.property);

    case 'namespaced_call':
      return evaluateNamespacedCall(ast.namespace, ast.member, ast.args, context, ast.property);

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
 * Apply a binary operator to two numbers
 *
 * Taking the operator as a parameter rather than switching on `ast.operator` in place is what
 * lets the exhaustiveness check compile: in the `default` arm the *parameter* narrows to `never`,
 * where narrowing the whole node would have narrowed `ast` itself and made `ast.operator`
 * unreadable. That is the shape the rest of the engine uses (`dependencies.ts`, `curves.ts`).
 */
function applyBinary(
  operator: BinaryOpNode['operator'],
  left: number,
  right: number
): FormulaResult {
  switch (operator) {
    case '+':
      return finite(left + right, `${left} + ${right}`);
    case '-':
      return finite(left - right, `${left} - ${right}`);
    case '*':
      return finite(left * right, `${left} * ${right}`);
    case '/':
      return right === 0
        ? formulaError('division-by-zero', 'Division by zero')
        : finite(left / right, `${left} / ${right}`);
    case '^':
      return power(left, right);
    default: {
      // Parser and evaluator disagree about the operator set — an engine bug
      const _exhaustive: never = operator;
      throw new Error(`Unknown binary operator: ${_exhaustive}`);
    }
  }
}

/**
 * The one place a raw IEEE result becomes a `FormulaResult`
 *
 * `NaN` and `Infinity` are `number`s as far as the type system is concerned, so an unguarded one
 * flows through the rest of the expression, past `isFormulaError` and `asNumber`, and onto a
 * character sheet — the silent-wrong-number failure Concept 00 §7 exists to prevent. Every
 * arithmetic result in this module goes through here, not just the operators that produce one
 * *often*: `10 ^ 200 * 10 ^ 200` overflows on the `*`, one operator past the obvious guard.
 *
 * @param value - The raw result
 * @param expression - What produced it, for the message
 */
function finite(value: number, expression: string): FormulaResult {
  if (Number.isNaN(value)) {
    return formulaError('not-evaluable', `${expression} has no numeric value`);
  }

  if (!Number.isFinite(value)) {
    return formulaError('not-evaluable', `${expression} is too large to represent`);
  }

  return value;
}

/**
 * Raise `base` to `exponent`, naming the two failures that have their own explanation
 *
 * Overflow is left to `finite` — it is not special to exponentiation. These two are: a negative
 * power is one over a positive one, so `0 ^ -1` really is a division by zero, and a negative base
 * under a fractional power has no *real* value rather than a value too big to hold
 * (TICKET-FORM-07).
 */
function power(base: number, exponent: number): FormulaResult {
  if (base === 0 && exponent < 0) {
    return formulaError(
      'division-by-zero',
      `0 ^ ${exponent} is a division by zero — a negative power is one over a positive one`
    );
  }

  const result = base ** exponent;

  if (Number.isNaN(result)) {
    return formulaError(
      'not-evaluable',
      `${base} ^ ${exponent} has no real value — a negative base needs a whole-number power`
    );
  }

  return finite(result, `${base} ^ ${exponent}`);
}

/**
 * Apply a unary operator to a number — same exhaustiveness shape as `applyBinary`
 */
function applyUnary(operator: UnaryOpNode['operator'], operand: number): FormulaResult {
  switch (operator) {
    case 'negate':
      return -operand;
    default: {
      // Parser and evaluator disagree about the operator set — an engine bug
      const _exhaustive: never = operator;
      throw new Error(`Unknown unary operator: ${_exhaustive}`);
    }
  }
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

  return finite(fn.apply(values), `${name}(${values.join(', ')})`);
}

/**
 * Call a namespace member, propagating the first errored argument
 *
 * A namespace with no `call` has no callable members at all, which is a different mistake from
 * naming one that does not exist — `const.bonus_divider(2)` is worth its own message.
 */
function evaluateNamespacedCall(
  namespace: string,
  member: string,
  args: FormulaAST[],
  context: FormulaContext,
  property?: string
): FormulaResult {
  const resolver = context.namespaces?.[namespace];
  if (!resolver) {
    return formulaError('unknown-namespace', `Unknown namespace: ${namespace}`);
  }

  if (!resolver.call) {
    return formulaError('not-evaluable', `${namespace}.${member} is not callable`);
  }

  const values: number[] = [];
  for (const arg of args) {
    const value = evaluateFormula(arg, context);
    if (isFormulaError(value)) return value;
    values.push(value);
  }

  // Returned as-is when it is an error: unlike a reference, a call that fails failed *here*, so
  // there is no upstream to name and wrapping it would only bury the message the User needs.
  const result = resolver.call(member, values, property);
  return result === undefined
    ? formulaError('unknown-member', `Unknown member: ${namespace}.${member}`)
    : result;
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
