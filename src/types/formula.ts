/**
 * Formula Engine Types
 * 
 * Type definitions for the formula parsing, evaluation, and validation system.
 */

/**
 * Formula Abstract Syntax Tree (AST) node types
 */
export type FormulaAST =
  | NumberNode
  | VariableNode
  | BinaryOpNode
  | UnaryOpNode;

/**
 * Number literal node
 */
export interface NumberNode {
  type: 'number';
  value: number;
}

/**
 * Variable reference node (skill code)
 */
export interface VariableNode {
  type: 'variable';
  value: string; // 3-letter skill code
}

/**
 * Binary operation node (+, -, *, /)
 */
export interface BinaryOpNode {
  type: 'binary_op';
  operator: '+' | '-' | '*' | '/';
  left: FormulaAST;
  right: FormulaAST;
}

/**
 * Unary operation node (negation)
 */
export interface UnaryOpNode {
  type: 'unary_op';
  operator: 'negate';
  operand: FormulaAST;
}

/**
 * Formula context - provides variable values for evaluation
 */
export interface FormulaContext {
  variables: Record<string, number>; // skillCode -> value
}

/**
 * Formula validation result
 */
export interface FormulaValidationResult {
  isValid: boolean;
  errors: string[];
  referencedVariables: string[]; // List of skill codes referenced in formula
}

/**
 * Dice roll result for a single die type
 */
export interface DiceRollResult {
  dieType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20';
  rolls: number[]; // Individual die results
  total: number; // Sum of all rolls for this die type
}

/**
 * Complete combat roll result with breakdown
 */
export interface CombatRollResult {
  skillCode: string;
  skillName: string;
  diceResults: DiceRollResult[];
  diceTotal: number; // Sum of all dice
  bonus: number; // Calculated from formula
  total: number; // diceTotal + bonus
  timestamp: string;
}

/**
 * Formula evaluation error
 */
export interface FormulaError {
  message: string;
  position?: number; // Character position in formula string
  variable?: string; // Undefined variable if applicable
}
