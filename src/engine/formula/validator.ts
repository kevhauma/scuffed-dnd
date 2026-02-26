/**
 * Formula Validator
 * 
 * Validates formula syntax, detects undefined variable references,
 * and detects circular dependencies in formula chains.
 */

import type { FormulaAST, FormulaValidationResult } from '../../types/formula';
import { parseFormula } from './parser';

/**
 * Extract all variable references from an AST
 * 
 * @param ast - The Abstract Syntax Tree to analyze
 * @returns Array of unique variable names referenced in the formula
 */
function extractVariables(ast: FormulaAST): string[] {
  const variables = new Set<string>();

  function traverse(node: FormulaAST): void {
    switch (node.type) {
      case 'number':
        // No variables in number nodes
        break;

      case 'variable':
        variables.add(node.value);
        break;

      case 'binary_op':
        traverse(node.left);
        traverse(node.right);
        break;

      case 'unary_op':
        traverse(node.operand);
        break;

      default:
        // TypeScript exhaustiveness check
        const _exhaustive: never = node;
        throw new Error(`Unknown AST node type: ${(_exhaustive as FormulaAST).type}`);
    }
  }

  traverse(ast);
  return Array.from(variables);
}

/**
 * Validate a formula string
 * 
 * @param formula - Formula string to validate
 * @param availableVariables - Set of valid variable names (skill codes)
 * @returns Validation result with errors and referenced variables
 */
export function validateFormula(
  formula: string,
  availableVariables?: Set<string>
): FormulaValidationResult {
  const errors: string[] = [];
  let referencedVariables: string[] = [];

  // Empty formula check
  if (!formula || formula.trim() === '') {
    errors.push('Formula cannot be empty');
    return {
      isValid: false,
      errors,
      referencedVariables: [],
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
    };
  }

  // Extract referenced variables
  try {
    referencedVariables = extractVariables(ast);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Error extracting variables');
    return {
      isValid: false,
      errors,
      referencedVariables: [],
    };
  }

  // Check for undefined variable references if availableVariables provided
  if (availableVariables) {
    const undefinedVars = referencedVariables.filter(
      (varName) => !availableVariables.has(varName)
    );

    if (undefinedVars.length > 0) {
      errors.push(
        `Undefined variable${undefinedVars.length > 1 ? 's' : ''}: ${undefinedVars.join(', ')}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    referencedVariables,
  };
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
export function detectCircularDependencies(
  formulas: FormulaDependency[]
): string[][] {
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
export function validateFormulaCollection(
  formulas: FormulaDependency[]
): FormulaValidationResult {
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
  };
}
