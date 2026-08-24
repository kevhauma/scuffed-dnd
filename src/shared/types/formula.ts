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
 * Binary operation node (+, -, *, /, ^)
 *
 * `^` is right-associative and binds tighter than `*` but looser than unary minus — the grammar
 * in `engine/formula/parser.ts` is the authority, and TICKET-FORM-07 records why.
 */
export interface BinaryOpNode {
  type: 'binary_op';
  operator: '+' | '-' | '*' | '/' | '^';
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
 * Namespaced call node — `curve.cr(x)`, `curve.point_buy.main_type(x)`
 *
 * `property` selects *which* output the call produces — a curve's value column. It is a third
 * segment rather than a second argument because an argument is an expression, and a bare
 * identifier in an expression is already a variable reference: the grammar could not tell a
 * column name from a skill code (TICKET-CRV-01, divergence note).
 */
export interface NamespacedCallNode {
  type: 'namespaced_call';
  namespace: string;
  member: string;
  property?: string;
  args: FormulaAST[];
}

/**
 * What kind of data problem produced an error value (Concept 00 §7)
 *
 * Every one of these is a mistake in the *ruleset*, which the User can see and fix. Bugs in the
 * engine itself are not on this list — those still throw.
 */
export type FormulaErrorKind =
  | 'syntax'
  | 'undefined-variable'
  | 'unknown-function'
  | 'wrong-arity'
  | 'unknown-namespace'
  | 'unknown-member'
  | 'division-by-zero'
  /** A curve was asked for a key outside its table and is configured to refuse (Concept 06) */
  | 'out-of-range'
  | 'not-evaluable'
  /** This value could not be calculated because one it reads could not be (see `cause`) */
  | 'upstream';

/**
 * The entity whose formula produced an error, for display and jump-to
 */
export interface FormulaErrorSource {
  kind: 'stat' | 'skill' | 'roll';
  id: string;
  name: string;
}

/**
 * An error **value** — the result of a formula that could not produce a number
 *
 * Errors are values, not exceptions (Concept 00 §7): they propagate through arithmetic and
 * across formulas, carrying `cause` so a broken value downstream can name what actually broke.
 * There is deliberately no `iferror` — an error is meant to stay visible.
 *
 * `formulaError` is a brand so `isFormulaError` can tell an error from a number safely.
 */
export interface FormulaError {
  readonly formulaError: true;
  kind: FormulaErrorKind;
  message: string;
  /** The upstream error this one came from, if any */
  cause?: FormulaError;
  /** The entity whose formula failed, attached by the calculators */
  source?: FormulaErrorSource;
}

/**
 * What evaluating a formula produces: a number, or an error explaining why not
 */
export type FormulaResult = number | FormulaError;

/**
 * Resolves members of one namespace (`stats`, `skills`, `const`, `curve`, …) during evaluation.
 *
 * Returns `undefined` for an unknown member/property — the evaluator turns that into an
 * "Unknown member" error, distinct from an undefined bare variable. A resolver may also return
 * an error value, which propagates like any other.
 *
 * `call` backs the call form (`curve.xp_thresholds(x)`). A resolver without it has no callable
 * members, which the evaluator reports as such rather than as an unknown member — `const.x(1)`
 * is a different mistake from `const.nope`.
 */
export interface NamespaceResolver {
  resolve(member: string, property?: string): FormulaResult | undefined;
  /**
   * Call a member with already-evaluated arguments.
   *
   * @param member - The member named before the parentheses
   * @param args - Evaluated arguments; errors are propagated by the evaluator, never passed here
   * @param property - The third segment, when one was written (a curve's value column)
   * @returns The result, or `undefined` when the member does not exist
   */
  call?(member: string, args: number[], property?: string): FormulaResult | undefined;
}

/**
 * Formula context - provides variable values for evaluation
 *
 * `variables` is the legacy flat lookup for bare codes (deprecated — removed by
 * TICKET-STAT-01); `namespaces` carries the resolvers for dotted references. Values may be
 * errors: reading one yields an `upstream` error naming it, which is how provenance chains
 * from one formula to the next.
 */
export interface FormulaContext {
  variables: Record<string, FormulaResult>; // stat abbreviation -> value or error
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
 * What one rung of a dice ladder rolled (Concept 07)
 *
 * Keyed by `size` rather than by a die-type name, which is the ladder's whole point: a d100 is
 * data. It replaced a six-name union (`'d4' | … | 'd20'`) in TICKET-ROLL-06, with `DiceConfig`.
 *
 * Lives here rather than beside `decomposeValue` because `RollOutcome` carries it and `types/`
 * cannot import from `engine/`.
 */
export interface DieRollResult {
  size: number;
  /** Every individual die, so a Player can see the roll rather than only its sum */
  rolls: number[];
  total: number;
}

/**
 * One roll of a roll definition, spelled out (Concept 08, TICKET-ROLL-06)
 *
 * **The only dice-result shape in the app** — `useUIStore`'s `RollResult` extends it and adds who
 * rolled it. Don't reintroduce a second one.
 *
 * It carries the whole chain, because the point of the ladder is that the chain is visible: the
 * number the input evaluated to, the pool that number decomposed into, what each rung actually
 * rolled, and the flat the ladder could not fill a die with. `total` is `diceTotal + flat`, and
 * `notation` is the same string the button showed — kept on the result rather than re-derived, so
 * a history entry cannot drift from the roll it records.
 */
export interface RollOutcome {
  rollId: string;
  rollName: string;
  /** What the definition's input evaluated to — the number fed to the ladder */
  input: number;
  /** One entry per rung, in ladder order; a rung with no dice is still here */
  dice: DieRollResult[];
  /** Sum of every die */
  diceTotal: number;
  /** What no die could take (Concept 07's remainder) */
  flat: number;
  /** `diceTotal + flat` */
  total: number;
  /** The pool as the sheet showed it — `1D20 + 1D12 + 1D6 + 1` */
  notation: string;
  timestamp: string;
}
