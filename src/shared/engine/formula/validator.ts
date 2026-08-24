/**
 * Formula Validator
 *
 * Validates formula syntax, detects undefined variable references, checks calls against the
 * closed function library, scopes dotted references against their attachment point's row in
 * `scoping.ts`, and detects circular dependencies in formula chains. Bare codes and dotted
 * references resolve to the same entity ids, so a cycle written either way is caught — see
 * `dependencyKeysOf`.
 *
 * **Validates: Requirements 16.4, 16.5, 16.6, 18.1, 18.2; Concepts 00 §5, 01, 02; spec §5.1, §5.3**
 */

import type { FormulaAST, FormulaValidationResult, NamespacedReference } from '../../types/formula';
import { describeArity, FORMULA_FUNCTIONS } from './functions';
import { parseFormula } from './parser';
import type { ReferenceResolver } from './references';
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
      references.push({
        namespace: node.namespace,
        member: node.member,
        ...(node.property === undefined ? {} : { property: node.property }),
      });
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
 * The dependency graph is keyed by **entity id**, and a formula is written in display spellings —
 * so every reference is put through the resolver, which is what makes `STR` and `stats.strength`
 * land on the same node and a cycle written either way get caught.
 *
 * Before CR-01 this returned the spellings themselves, which only worked while an entity's id
 * happened to equal the way formulas spell it. Real ids are UUIDs, so no edge ever matched a node
 * and the whole detector was dead in production. The resolver is namespace-aware for the same
 * reason `dependencies.ts` is: a stat slugged `bonus_divider` and a constant named
 * `bonus_divider` are different entities.
 *
 * A reference that resolves to nothing contributes no edge — an undefined code is the scope
 * check's problem, not the cycle detector's.
 *
 * @param result - A result from `validateFormula`
 * @param resolve - Maps a reference to the entity id it names (`buildReferenceResolver`)
 * @returns Unique graph node ids the formula references
 */
export function dependencyKeysOf(
  result: FormulaValidationResult,
  resolve: ReferenceResolver
): string[] {
  const nodes = [
    ...result.referencedVariables.map((code) => resolve(undefined, code)),
    ...result.namespacedReferences.map((reference) =>
      resolve(reference.namespace, reference.member)
    ),
  ];

  return Array.from(new Set(nodes.filter((id): id is string => id !== undefined)));
}

/**
 * Build a dependency-graph entry for one formula
 *
 * The single place that turns a formula into graph edges, so every caller of
 * `validateFormulaCollection` agrees about what an edge is.
 *
 * @param node - The entity the formula is attached to: its graph id, how to name it in a report,
 *   and the formula itself
 * @param resolve - Maps a reference to the entity id it names (`buildReferenceResolver`)
 * @returns The graph entry
 */
export function toFormulaDependency(
  node: { id: string; label: string; formula: string },
  resolve: ReferenceResolver
): FormulaDependency {
  return {
    id: node.id,
    label: node.label,
    formula: node.formula,
    referencedVariables: dependencyKeysOf(validateFormula(node.formula), resolve),
  };
}

/**
 * Formula dependency information
 */
export interface FormulaDependency {
  /** The graph node: the owning entity's stable id */
  id: string;
  /**
   * How the node is named in a cycle report
   *
   * Separate from `id` because the id is a UUID in every real configuration, and
   * "Circular dependency detected: 7c22… → b1f0…" tells the User nothing. Optional so a test can
   * build a graph out of bare node names; it falls back to `id`.
   */
  label?: string;
  formula: string;
  /** Ids of the entities this formula reads — the outgoing edges */
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
   *
   * Every path out of this function backtracks (CR-08). The early `return true` this used to do on
   * finding a cycle left the node on `recursionStack` and `currentPath` for the rest of the run, so
   * later traversals reported cycles along edges that do not exist — `A→{B,C}, B→B, C→B` claimed a
   * `B → C → B` chain on top of the real `B → B`.
   */
  function dfs(nodeId: string): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const formula = formulaMap.get(nodeId);
    for (const varId of formula?.referencedVariables ?? []) {
      // Only follow dependencies that are also formulas
      if (!formulaMap.has(varId)) {
        continue;
      }

      // Seen in the current recursion stack: the path from there back to here is a cycle. Recorded
      // rather than returned on, so this node's remaining edges are walked too.
      if (recursionStack.has(varId)) {
        const cycleStartIndex = currentPath.indexOf(varId);
        circularChains.push([...currentPath.slice(cycleStartIndex), varId]);
        continue;
      }

      if (!visited.has(varId)) {
        dfs(varId);
      }
    }

    // Backtrack
    recursionStack.delete(nodeId);
    currentPath.pop();
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

  // Detect circular dependencies. The chains come back as node ids — UUIDs in any real
  // configuration — so each one is spelled back out through the node's label before it is shown.
  const labels = new Map(formulas.map((formula) => [formula.id, formula.label ?? formula.id]));
  const circularChains = detectCircularDependencies(formulas);

  for (const chain of circularChains) {
    const path = chain.map((nodeId) => labels.get(nodeId) ?? nodeId).join(' → ');
    errors.push(`Circular dependency detected: ${path}`);
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
