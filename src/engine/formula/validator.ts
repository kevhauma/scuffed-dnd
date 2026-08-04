/**
 * Formula Validator
 *
 * Validates formula syntax, detects undefined variable references, checks calls against the
 * closed function library, scopes dotted references against their attachment point's row in
 * `scoping.ts`, and detects circular dependencies in formula chains. Bare codes and dotted
 * references share graph nodes, so a cycle written either way is caught — see
 * `formulaDependencyKeys`.
 *
 * **Validates: Requirements 16.4, 16.5, 16.6, 18.1, 18.2; Concepts 00 §5, 01, 02; spec §5.1, §5.3**
 */

import type { FormulaAST, FormulaValidationResult, NamespacedReference } from '../../types/formula';
import { describeArity, FORMULA_FUNCTIONS } from './functions';
import { parseFormula } from './parser';
import type { FormulaScope } from './scoping';
import { isKnownNamespace } from './scoping';

/**
 * Visit every node of an AST, parents before children
 *
 * The one place that knows the shape of the union, so a new node type is handled here
 * rather than in each analysis pass. Namespaced references have no children to descend into;
 * the passes below decide what to do with them.
 *
 * @param ast - The Abstract Syntax Tree to walk
 * @param visit - Called once per node
 */
function walkFormula(ast: FormulaAST, visit: (node: FormulaAST) => void): void {
  visit(ast);

  switch (ast.type) {
    case 'number':
    case 'variable':
    case 'namespaced_ref':
      break;

    case 'binary_op':
      walkFormula(ast.left, visit);
      walkFormula(ast.right, visit);
      break;

    case 'unary_op':
      walkFormula(ast.operand, visit);
      break;

    case 'function_call':
    case 'namespaced_call':
      for (const arg of ast.args) {
        walkFormula(arg, visit);
      }
      break;

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = ast;
      throw new Error(`Unknown AST node type: ${(_exhaustive as FormulaAST).type}`);
    }
  }
}

/**
 * Extract all variable references from an AST
 *
 * Only legacy bare codes count — a namespaced reference is not a variable.
 *
 * @param ast - The Abstract Syntax Tree to analyze
 * @returns Array of unique variable names referenced in the formula
 */
function extractVariables(ast: FormulaAST): string[] {
  const variables = new Set<string>();

  walkFormula(ast, (node) => {
    if (node.type === 'variable') {
      variables.add(node.value);
    }
  });

  return Array.from(variables);
}

/**
 * Collect function-call errors from an AST: unknown names and wrong arity
 *
 * Library names are matched case-sensitively — `ROUND(…)` is an unknown function.
 */
function collectFunctionErrors(ast: FormulaAST): string[] {
  const errors: string[] = [];

  walkFormula(ast, (node) => {
    if (node.type !== 'function_call') {
      return;
    }

    const fn = FORMULA_FUNCTIONS[node.name];
    if (!fn) {
      errors.push(`Unknown function: ${node.name}`);
      return;
    }

    if (node.args.length < fn.minArgs || (fn.maxArgs !== null && node.args.length > fn.maxArgs)) {
      errors.push(`${node.name} expects ${describeArity(fn)}, got ${node.args.length}`);
    }
  });

  return errors;
}

/**
 * Extract every dotted reference from an AST, as written
 */
function extractNamespacedReferences(ast: FormulaAST): NamespacedReference[] {
  const references: NamespacedReference[] = [];

  walkFormula(ast, (node) => {
    if (node.type === 'namespaced_ref') {
      references.push({
        namespace: node.namespace,
        member: node.member,
        ...(node.property === undefined ? {} : { property: node.property }),
      });
    } else if (node.type === 'namespaced_call') {
      references.push({ namespace: node.namespace, member: node.member });
    }
  });

  return references;
}

/**
 * Render a namespaced reference the way the user wrote it
 */
function referencePath(reference: NamespacedReference): string {
  return reference.property
    ? `${reference.namespace}.${reference.member}.${reference.property}`
    : `${reference.namespace}.${reference.member}`;
}

/**
 * Check dotted references against the scope of their attachment point
 *
 * Produces the three distinct scoping errors: a namespace the engine has never heard of, a
 * namespace that exists but is out of scope here, and a member the namespace does not provide.
 */
function collectScopeErrors(references: NamespacedReference[], scope: FormulaScope): string[] {
  const errors: string[] = [];

  for (const reference of references) {
    if (!isKnownNamespace(reference.namespace)) {
      errors.push(`Unknown namespace: ${reference.namespace}`);
      continue;
    }

    const members = scope.namespaces[reference.namespace];
    if (!members) {
      errors.push(`Namespace not available here: ${reference.namespace}`);
      continue;
    }

    if (!members.has(reference.member)) {
      errors.push(`Unknown member: ${referencePath(reference)}`);
    }
  }

  return errors;
}

/**
 * Validate a formula string
 *
 * @param formula - Formula string to validate
 * @param availableVariables - Set of valid legacy bare codes; omit to skip the check
 * @param scope - The attachment point's scope (`scopeFor(config, owner)`); omit to skip
 *   namespace and member checks, which is what callers that only need syntax should do
 * @returns Validation result with errors, bare codes, and dotted references
 */
export function validateFormula(
  formula: string,
  availableVariables?: ReadonlySet<string>,
  scope?: FormulaScope
): FormulaValidationResult {
  const errors: string[] = [];

  // Empty formula check
  if (!formula || formula.trim() === '') {
    errors.push('Formula cannot be empty');
    return {
      isValid: false,
      errors,
      referencedVariables: [],
      namespacedReferences: [],
    };
  }

  // Try to parse the formula
  let ast: FormulaAST;
  try {
    ast = parseFormula(formula);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown parsing error');
    return {
      isValid: false,
      errors,
      referencedVariables: [],
      namespacedReferences: [],
    };
  }

  // Extract references
  let referencedVariables: string[] = [];
  let namespacedReferences: NamespacedReference[] = [];
  try {
    referencedVariables = extractVariables(ast);
    namespacedReferences = extractNamespacedReferences(ast);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Error extracting variables');
    return {
      isValid: false,
      errors,
      referencedVariables: [],
      namespacedReferences: [],
    };
  }

  // Unknown functions and wrong arity (parse succeeds; these are validation errors)
  errors.push(...collectFunctionErrors(ast));

  // Check for undefined variable references if availableVariables provided
  if (availableVariables) {
    const undefinedVars = referencedVariables.filter((varName) => !availableVariables.has(varName));

    if (undefinedVars.length > 0) {
      errors.push(
        `Undefined variable${undefinedVars.length > 1 ? 's' : ''}: ${undefinedVars.join(', ')}`
      );
    }
  }

  // Namespace and member scoping if a scope was provided
  if (scope) {
    errors.push(...collectScopeErrors(namespacedReferences, scope));
  }

  return {
    isValid: errors.length === 0,
    errors,
    referencedVariables,
    namespacedReferences,
  };
}

/**
 * Graph keys a validated formula depends on, for cycle detection
 *
 * Bare codes are keys already; a dotted reference contributes its **member**, which is the stat
 * id or skill code the dependency graph is keyed by. So `stats.health` and legacy `HEALTH` land
 * on the same node and a cycle written either way is caught.
 *
 * The namespace is deliberately dropped, which is what makes that parity work — the cost is that
 * `stats.x` and `skills.x` would share a node and could report a phantom cycle. Not reachable
 * today (stat ids are lowercase slugs, skill codes are 3-letter uppercase) but worth knowing
 * before TICKET-STAT-01 reshapes either key space.
 *
 * @param result - A result from `validateFormula`
 * @returns Unique graph keys the formula references
 */
export function dependencyKeysOf(result: FormulaValidationResult): string[] {
  return Array.from(
    new Set([
      ...result.referencedVariables,
      ...result.namespacedReferences.map((reference) => reference.member),
    ])
  );
}

/**
 * Build a dependency-graph entry for one formula
 *
 * The single place that turns a formula into graph edges, so every caller of
 * `validateFormulaCollection` agrees about what an edge is.
 */
export function toFormulaDependency(id: string, formula: string): FormulaDependency {
  return { id, formula, referencedVariables: dependencyKeysOf(validateFormula(formula)) };
}

/**
 * Formula dependency information
 */
export interface FormulaDependency {
  id: string; // Unique identifier for the formula (e.g., stat ID or skill code)
  formula: string;
  referencedVariables: string[];
}

/**
 * Detect circular dependencies in a set of formulas
 *
 * @param formulas - Array of formula dependencies to check
 * @returns Array of circular dependency chains found (empty if none)
 */
export function detectCircularDependencies(formulas: FormulaDependency[]): string[][] {
  const circularChains: string[][] = [];
  const formulaMap = new Map<string, FormulaDependency>();

  // Build formula map
  for (const formula of formulas) {
    formulaMap.set(formula.id, formula);
  }

  // Track visited nodes for each DFS traversal
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const currentPath: string[] = [];

  /**
   * Depth-first search to detect cycles
   */
  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const formula = formulaMap.get(nodeId);
    if (formula) {
      // Check each variable this formula references
      for (const varId of formula.referencedVariables) {
        // Only follow dependencies that are also formulas
        if (!formulaMap.has(varId)) {
          continue;
        }

        // If we've seen this node in current recursion stack, we found a cycle
        if (recursionStack.has(varId)) {
          // Extract the cycle from currentPath
          const cycleStartIndex = currentPath.indexOf(varId);
          const cycle = [...currentPath.slice(cycleStartIndex), varId];
          circularChains.push(cycle);
          return true;
        }

        // If not visited, recurse
        if (!visited.has(varId)) {
          if (dfs(varId)) {
            // Continue searching for more cycles
            // Don't return immediately to find all cycles
          }
        }
      }
    }

    // Backtrack
    recursionStack.delete(nodeId);
    currentPath.pop();
    return false;
  }

  // Run DFS from each unvisited node
  for (const formula of formulas) {
    if (!visited.has(formula.id)) {
      dfs(formula.id);
    }
  }

  return circularChains;
}

/**
 * Validate a collection of formulas for circular dependencies
 *
 * @param formulas - Array of formula dependencies to validate
 * @returns Validation result with circular dependency errors
 */
export function validateFormulaCollection(formulas: FormulaDependency[]): FormulaValidationResult {
  const errors: string[] = [];
  const allReferencedVariables = new Set<string>();

  // Collect all referenced variables
  for (const formula of formulas) {
    for (const varName of formula.referencedVariables) {
      allReferencedVariables.add(varName);
    }
  }

  // Detect circular dependencies
  const circularChains = detectCircularDependencies(formulas);

  if (circularChains.length > 0) {
    for (const chain of circularChains) {
      errors.push(`Circular dependency detected: ${chain.join(' → ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    referencedVariables: Array.from(allReferencedVariables),
    // Always empty: this pass reasons about graph keys supplied by the caller, not about the
    // references in any one formula. Read them from `validateFormula` instead.
    namespacedReferences: [],
  };
}
