/**
 * Formula Error Values
 *
 * Constructors and accessors for the error **values** the evaluator returns instead of throwing
 * (Concept 00 §7). A broken formula poisons its own value and nothing else; downstream formulas
 * that read it get an `upstream` error naming the cause, so a chain stays traceable to its root.
 *
 * Deliberately absent: any `iferror`-style swallow. Callers that need a number for display use
 * `numberOr`, which is an explicit local fallback, not a way to hide the error.
 *
 * **Validates: Concept 00 §7; spec §5.5; Requirement 16.6**
 */

import type {
  FormulaError,
  FormulaErrorKind,
  FormulaErrorSource,
  FormulaResult,
} from '../../types/formula';

/**
 * Build an error value
 *
 * @param kind - Which data problem this is
 * @param message - Text safe to show the User verbatim
 * @param options - Optional upstream cause and owning entity
 */
export function formulaError(
  kind: FormulaErrorKind,
  message: string,
  options: { cause?: FormulaError; source?: FormulaErrorSource } = {}
): FormulaError {
  return {
    formulaError: true,
    kind,
    message,
    ...(options.cause === undefined ? {} : { cause: options.cause }),
    ...(options.source === undefined ? {} : { source: options.source }),
  };
}

/**
 * Whether a value is an error rather than a number
 */
export function isFormulaError(value: unknown): value is FormulaError {
  // Checks the brand's *value*, not just the key: `NamespaceResolver` is a public extension
  // point, and an object that merely carries a `formulaError` key must not be narrowed here.
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { formulaError?: unknown }).formulaError === true
  );
}

/**
 * The number a result holds, or `undefined` if it is an error
 *
 * Use when absence is meaningful — rendering an error chip, skipping a clamp.
 */
export function asNumber(result: FormulaResult | undefined): number | undefined {
  return result === undefined || isFormulaError(result) ? undefined : result;
}

/**
 * The number a result holds, or an explicit fallback
 *
 * Use only where a number is structurally required and the error is surfaced *elsewhere* —
 * never as a way to make a broken formula look fine.
 */
export function numberOr(result: FormulaResult | undefined, fallback: number): number {
  return asNumber(result) ?? fallback;
}

/**
 * Attach the owning entity to an error, keeping the innermost source that already has one
 *
 * Calculators call this so an error knows which stat or skill it belongs to, while an error
 * that travelled from upstream keeps pointing at where it actually started.
 */
export function withSource(error: FormulaError, source: FormulaErrorSource): FormulaError {
  return error.source ? error : { ...error, source };
}

/**
 * Render an error and its causes as one line, root cause last
 *
 * `Stat "Armour": Undefined variable: STR` becomes
 * `… ← Stat "Health": Undefined variable: STR` when it arrived through another formula.
 */
export function describeFormulaError(error: FormulaError): string {
  const parts: string[] = [];

  for (let current: FormulaError | undefined = error; current; current = current.cause) {
    const label = current.source ? `${sourceLabel(current.source)}: ` : '';
    parts.push(`${label}${current.message}`);
  }

  return parts.join(' ← ');
}

/**
 * The root of an error chain — the thing that actually needs fixing
 */
export function rootCause(error: FormulaError): FormulaError {
  let current = error;
  while (current.cause) {
    current = current.cause;
  }
  return current;
}

/**
 * Human label for an error's owning entity
 */
function sourceLabel(source: FormulaErrorSource): string {
  const kindLabels: Record<FormulaErrorSource['kind'], string> = {
    stat: 'Stat',
    skill: 'Skill',
    'combat-skill': 'Combat Skill',
  };

  return `${kindLabels[source.kind]} "${source.name}"`;
}
