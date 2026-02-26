/**
 * Formula Evaluator
 * 
 * Evaluates Abstract Syntax Trees (AST) with a given context to produce numeric results.
 * Handles arithmetic operations with proper precedence through the AST structure.
 */

import type { FormulaAST, FormulaContext } from '../../types/formula';

/**
 * Evaluate a formula AST with the given context
 * 
 * @param ast - The Abstract Syntax Tree to evaluate
 * @param context - Variable values for evaluation
 * @returns The calculated numeric result
 * @throws Error if a referenced variable is not found in context or division by zero occurs
 */
export function evaluateFormula(ast: FormulaAST, context: FormulaContext): number {
  switch (ast.type) {
    case 'number':
      return ast.value;

    case 'variable': {
      const value = context.variables[ast.value];
      if (value === undefined) {
        throw new Error(`Undefined variable: ${ast.value}`);
      }
      return value;
    }

    case 'binary_op': {
      const left = evaluateFormula(ast.left, context);
      const right = evaluateFormula(ast.right, context);

      switch (ast.operator) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          if (right === 0) {
            throw new Error('Division by zero');
          }
          return left / right;
        default:
          throw new Error(`Unknown binary operator: ${ast.operator}`);
      }
    }

    case 'unary_op': {
      const operand = evaluateFormula(ast.operand, context);

      switch (ast.operator) {
        case 'negate':
          return -operand;
        default:
          throw new Error(`Unknown unary operator: ${ast.operator}`);
      }
    }

    default:
      // TypeScript exhaustiveness check
      const _exhaustive: never = ast;
      throw new Error(`Unknown AST node type: ${(_exhaustive as FormulaAST).type}`);
  }
}
