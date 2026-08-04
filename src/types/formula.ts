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
  | UnaryOpNode
  | FunctionCallNode
  | NamespacedRefNode
  | NamespacedCallNode;

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
 * Function call node (closed library — see engine/formula/functions.ts)
 *
 * `name` is kept exactly as written: library names are lowercase and matched
 * case-sensitively, so `round(…)` is a call into the library while `ROUND(…)`
 * is an unknown function reported by validation.
 */
export interface FunctionCallNode {
  type: 'function_call';
  name: string;
  args: FormulaAST[];
}

/**
 * Namespaced reference node — `stats.speed`, `skills.healing.level`
 *
 * All segments are kept exactly as written; namespaces are lowercase and resolved
 * case-sensitively, member/property matching is the resolver's concern.
 */
export interface NamespacedRefNode {
  type: 'namespaced_ref';
  namespace: string;
  member: string;
  property?: string;
}

/**
 * Namespaced call node — `curve.cr(x)` (parse-only until TICKET-CRV-01 lands evaluation)
 */
export interface NamespacedCallNode {
  type: 'namespaced_call';
  namespace: string;
  member: string;
  args: FormulaAST[];
}

/**
 * Resolves members of one namespace (`stats`, `skills`, `const`, `curve`, …) during evaluation.
 *
 * Returns `undefined` for an unknown member/property — the evaluator turns that into an
 * "Unknown member" error, distinct from an undefined bare variable.
 */
export interface NamespaceResolver {
  resolve(member: string, property?: string): number | undefined;
}

/**
 * Formula context - provides variable values for evaluation
 *
 * `variables` is the legacy flat lookup for bare codes (deprecated — removed by
 * TICKET-STAT-01); `namespaces` carries the resolvers for dotted references.
 */
export interface FormulaContext {
  variables: Record<string, number>; // skillCode -> value
  namespaces?: Record<string, NamespaceResolver>;
}

/**
 * A dotted reference found in a formula, as written
 */
export interface NamespacedReference {
  namespace: string;
  member: string;
  property?: string;
}

/**
 * Formula validation result
 */
export interface FormulaValidationResult {
  isValid: boolean;
  errors: string[];
  referencedVariables: string[]; // List of legacy bare skill codes referenced in formula
  namespacedReferences: NamespacedReference[]; // Dotted references (`stats.speed`) referenced in formula
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
