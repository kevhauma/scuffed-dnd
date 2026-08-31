/**
 * Formula Preview
 *
 * What a formula actually produces, shown while the User is still typing it (TICKET-FORM-08).
 * A formula is a string you have to imagine the output of; `STR * 0.2 + CHA * 0.1` is not
 * obviously "about 6 for a Char-heavy character" until something evaluates it.
 *
 * Two readings, because they answer different questions. The **sample values** answer "what does
 * it give for *this* character", one editable box per input. The **ladder** answers "is this
 * formula roughly the right size" by sweeping every input together across nine levels — a
 * per-variable view was considered and set aside (User decision, 2026-08-09): scaling everything
 * at once reads in one glance, and the boxes are there for the exact case.
 *
 * Every number here comes from `evaluateFormulaString` with the same scoping and namespaces the
 * value will have at play time, so a preview and the real thing cannot disagree. Nothing is
 * computed twice and nothing is computed by hand.
 *
 * **Validates: Concept 00 §5, §7; Requirements 3.1, 3.2, 3.3, 16.4, 21.1-21.5**
 */

import { useCallback, useMemo } from 'react';
import { asNumber, isFormulaError } from '#shared/engine/formula/errors';
import type { FormulaOwner } from '#shared/engine/formula/scoping';
import { scopeFor } from '#shared/engine/formula/scoping';
import { validateFormula } from '#shared/engine/formula/validator';
import type { Configuration } from '#shared/types/config';
import type { FormulaErrorKind, FormulaResult } from '#shared/types/formula';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import {
  captionStyles,
  headerCellStyles,
  levelCellStyles,
  resultCellStyles,
  tableStyles,
} from './FormulaPreview.style';
import { previewInputs, useFormulaSamples } from './formulaSamples';
import { SampleInputs } from './SampleInputs';

/**
 * The levels the ladder walks (TICKET-FORM-08)
 *
 * Fixed rather than configurable: it is display only, and a User who wants a different point
 * types it into a sample box. Dense at the bottom because that is where a starting character
 * lives, then out to 50 to show what the formula does to a monster.
 */
const LADDER_LEVELS = [1, 2, 3, 4, 5, 10, 15, 20, 50] as const;

/**
 * Error kinds that cannot depend on the numbers going in (TICKET-FORM-09)
 *
 * A formula naming `skills.nope` names no skill the ruleset defines, and it will not acquire one
 * at level 15. Nine identical dashes say nothing; one line saying *why* says everything, so these
 * replace the numbers rather than decorating them.
 *
 * Exactly two, and the list is short on purpose. `division-by-zero`, `out-of-range` and `upstream`
 * plainly vary with the inputs, and so does `not-evaluable`: it is what an overflow
 * (`STR ^ 400` at a large sample) and a curve with no value at one key both produce, and blanking
 * the whole preview would hide the levels where the formula works — which is the opposite of what
 * this is for.
 */
const STRUCTURAL_ERROR_KINDS: ReadonlySet<FormulaErrorKind> = new Set([
  'unknown-namespace',
  'unknown-member',
]);

export interface FormulaPreviewProps {
  /** The formula as the User has it now — mid-edit and unparseable is expected, not exceptional */
  formula: string;
  /** Where this formula is attached, which decides what it may reference and how it resolves */
  owner: FormulaOwner;
  /** The ruleset the formula lives in */
  config: Configuration;
  className?: string;
}

export function FormulaPreview({ formula, owner, config, className = '' }: FormulaPreviewProps) {
  const scope = useMemo(() => scopeFor(config, owner), [config, owner]);

  const validation = useMemo(
    () => (formula.trim() === '' ? null : validateFormula(formula, scope.codes, scope)),
    [formula, scope]
  );

  const inputs = useMemo(
    () =>
      validation?.isValid
        ? previewInputs(config, validation.referencedVariables, validation.namespacedReferences)
        : [],
    [config, validation]
  );

  // The boxes, what they hold and how to evaluate at them all belong to `useFormulaSamples`
  // (TICKET-SPL-03), so this component and `TemplatePreview` cannot produce different numbers for
  // the same ruleset
  const { values, setSample, fieldPrefix, evaluate } = useFormulaSamples(config, owner, inputs);

  const evaluateAt = useCallback(
    (at: Record<string, number>) => evaluate(formula, at),
    [evaluate, formula]
  );

  const sampleResult = useMemo(
    () => (validation?.isValid ? evaluateAt(values) : undefined),
    [validation, evaluateAt, values]
  );

  /**
   * The message to show *instead of* the numbers, when no number is reachable at any level
   *
   * Only for the kinds that cannot change with the inputs — a member that names no skill the
   * ruleset defines reads the same at level 1 and at level 50 (TICKET-FORM-09).
   */
  const structuralError = useMemo(() => {
    if (!isFormulaError(sampleResult)) return null;

    return STRUCTURAL_ERROR_KINDS.has(sampleResult.kind) ? sampleResult.message : null;
  }, [sampleResult]);

  const ladder = useMemo(() => {
    if (!validation?.isValid || inputs.length === 0 || structuralError !== null) return [];

    return LADDER_LEVELS.map((level) => ({
      level,
      result: evaluateAt(Object.fromEntries(inputs.map((code) => [code, level]))),
    }));
  }, [validation, inputs, evaluateAt, structuralError]);

  // Nothing to preview and nothing to complain about
  if (validation === null) return null;

  return (
    <Card variant="bordered" className={`p-4 ${className}`.trim()}>
      <Text variant="body-small-secondary" as="p" className="mb-3">
        Preview
      </Text>

      {!validation.isValid ? (
        <Text variant="error" as="p">
          {validation.errors.join(' ')}
        </Text>
      ) : (
        <>
          <SampleInputs
            inputs={inputs}
            values={values}
            onChange={setSample}
            fieldPrefix={fieldPrefix}
          />

          {structuralError !== null ? (
            // Said once rather than nine times: this is the answer at every level
            <Text variant="error" as="p">
              {structuralError}
            </Text>
          ) : (
            <div className="flex justify-between items-center p-2 bg-forest/10 border border-forest rounded">
              <Text variant="body-small-secondary">
                {inputs.length > 0 ? 'At these values' : 'Result'}
              </Text>
              <Text variant="body" className="font-semibold text-forest font-mono">
                {formatResult(sampleResult)}
              </Text>
            </div>
          )}

          {ladder.length > 0 && (
            <div className="mt-3">
              <table className={tableStyles}>
                <caption className={captionStyles}>
                  <Text variant="body-small-secondary">With every input at the same level</Text>
                </caption>
                <thead>
                  <tr>
                    <th className={headerCellStyles} scope="col">
                      <Text variant="body-small-secondary">Level</Text>
                    </th>
                    <th className={headerCellStyles} scope="col">
                      <Text variant="body-small-secondary">Value</Text>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ladder.map(({ level, result }) => (
                    <tr key={level}>
                      {/* The level is what the row *is* about, so it heads the row rather than
                          sitting in it — that is what makes a screen reader say "15, 4.5" */}
                      <th className={levelCellStyles} scope="row">
                        <Text variant="body-small-secondary">{level}</Text>
                      </th>
                      <td className={resultCellStyles}>
                        <Text variant="body-small">{formatResult(result)}</Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/**
 * Render a result the way a number should read, or a dash when there is no number
 *
 * An error value is a legitimate outcome — a curve read out of range, a stat with no value — and
 * showing a dash is what keeps `NaN` and a confident, wrong `0` off the screen (Concept 00 §7).
 *
 * @param result - What the evaluator returned, or undefined when it was never run
 * @returns The text to display
 */
function formatResult(result: FormulaResult | undefined): string {
  const value = result === undefined ? undefined : asNumber(result);
  if (value === undefined) return '—';

  return String(Math.round(value * 100) / 100);
}
