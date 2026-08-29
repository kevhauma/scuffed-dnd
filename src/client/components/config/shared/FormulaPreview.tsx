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

import { useId, useMemo, useState } from 'react';
import { calculateSkills } from '#shared/engine/calculators/skillCalculator';
import { asNumber, isFormulaError } from '#shared/engine/formula/errors';
import { evaluateFormulaString } from '#shared/engine/formula/evaluator';
import { namespacesFor } from '#shared/engine/formula/namespaces';
import { skillMemberName, statMemberName } from '#shared/engine/formula/references';
import type { FormulaOwner } from '#shared/engine/formula/scoping';
import { scopeFor } from '#shared/engine/formula/scoping';
import { validateFormula } from '#shared/engine/formula/validator';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { FormulaErrorKind, FormulaResult } from '#shared/types/formula';
import { Card } from '../../ui/Card/Card';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import {
  captionStyles,
  headerCellStyles,
  levelCellStyles,
  resultCellStyles,
  tableStyles,
} from './FormulaPreview.style';

/**
 * The levels the ladder walks (TICKET-FORM-08)
 *
 * Fixed rather than configurable: it is display only, and a User who wants a different point
 * types it into a sample box. Dense at the bottom because that is where a starting character
 * lives, then out to 50 to show what the formula does to a monster.
 */
const LADDER_LEVELS = [1, 2, 3, 4, 5, 10, 15, 20, 50] as const;

/** What an unset sample box holds */
const DEFAULT_SAMPLE = 10;

/**
 * The character `calculateSkills` is given, so a previewed skill is its weights and nothing else
 *
 * A ruleset is being edited here, not played: the preview's claim is "at these stats, this
 * formula computes X", and someone's invested points would make that claim about one character.
 */
const UNINVESTED: Pick<Character, 'investedSkillPoints'> = { investedSkillPoints: {} };

/**
 * The equipment `calculateSkills` is given — none (TICKET-ITEM-01)
 *
 * {@link UNINVESTED}'s counterpart for the gear term, and stated as a named constant rather than an
 * inline `{}` for the same reason the parameter is required: *this preview has no equipment* is a
 * claim about what the number means, not an omission.
 */
const NO_GEAR: Record<string, number> = {};

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

/**
 * The inputs a formula reads, as one box each
 *
 * A stat reachable two ways — bare `STR` and dotted `stats.strength` — is **one** input, keyed by
 * the abbreviation. That is what stops the same stat getting two boxes that disagree.
 *
 * **A `skills.<name>` reference contributes the stats it is weighted on** (TICKET-SKL-02), because
 * that is what it is made of: a skill has no value of its own to offer a box for, and offering
 * none at all would be worse than either — `calculateSkills` skips a weight whose stat is absent
 * from `statValues`, so the level would quietly drop those terms and the preview would show a
 * confident wrong number. Naming the stats keeps the promise the module header makes: a preview
 * and the real thing cannot disagree.
 *
 * @param config - The ruleset, for the dotted-spelling → abbreviation mapping
 * @param referencedVariables - The bare codes the validator found
 * @param namespacedReferences - The dotted references the validator found
 * @returns The abbreviations to offer a box for, in the order they were first seen
 */
function previewInputs(
  config: Configuration,
  referencedVariables: string[],
  namespacedReferences: { namespace: string; member: string }[]
): string[] {
  const inputs: string[] = [];
  const add = (code: string) => {
    if (code && !inputs.includes(code)) inputs.push(code);
  };
  const addStatById = (statId: string) => {
    const stat = config.stats.find((candidate) => candidate.id === statId);
    if (stat) add(stat.abbreviation.toUpperCase());
  };

  for (const code of referencedVariables) add(code);

  for (const reference of namespacedReferences) {
    if (reference.namespace === 'stats') {
      const stat = config.stats.find((candidate) => statMemberName(candidate) === reference.member);
      if (stat) add(stat.abbreviation.toUpperCase());
      continue;
    }

    if (reference.namespace === 'skills') {
      const skill = config.skills.find(
        (candidate) => skillMemberName(candidate) === reference.member
      );
      for (const { statId } of skill?.statWeights ?? []) addStatById(statId);
    }
  }

  return inputs;
}

export function FormulaPreview({ formula, owner, config, className = '' }: FormulaPreviewProps) {
  // Kept across edits, so refining a formula does not reset the numbers the User set up. An input
  // that has never been touched simply has no entry and reads as the default.
  const [samples, setSamples] = useState<Record<string, number>>({});

  // The boxes are generated, so their ids are too — two previews on one page must not collide
  const fieldPrefix = useId();

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

  /**
   * Evaluate the formula with every input held at the given values
   *
   * The one place this component produces a number. Values go in twice — as bare `variables` and
   * as `statValues` keyed by stat id — so the two spellings of the same stat read the same box.
   *
   * **Skills follow from the stats rather than getting boxes of their own** (TICKET-SKL-02). A
   * skill's level is `Σ(weight × stat) + invested`, so once the sample stats are chosen the skill
   * levels are decided too — a box for `skills.stealth` could only disagree with them. They come
   * from `calculateSkills`, the same function the sheet reads, over a character who has invested
   * nothing: the preview answers "what does this formula compute at these stats", and a Player's
   * investment is not a property of the ruleset being edited.
   *
   * They are supplied for **every** owner, which is safe because `namespacesFor` gates on
   * `scoping.ts` — an owner whose row has no `skills` gets no resolver for it no matter what is
   * handed in. That gate is what CR-02 turned into the truth: the `stat` row used to list
   * `skills`, so this preview vouched for a formula the sheet could never compute.
   */
  const evaluateAt = useMemo(() => {
    const byAbbreviation = new Map(
      config.stats.map((stat) => [stat.abbreviation.toUpperCase(), stat.id])
    );

    return (values: Record<string, number>): FormulaResult => {
      const statValues: Record<string, FormulaResult> = {};
      for (const [code, value] of Object.entries(values)) {
        const id = byAbbreviation.get(code);
        if (id !== undefined) statValues[id] = value;
      }

      // No gear either, for the same reason there is no investment: what a Player happens to be
      // wielding is not a property of the ruleset being edited (TICKET-ITEM-01)
      const { levels, bonuses } = calculateSkills(config, statValues, UNINVESTED, NO_GEAR);

      return evaluateFormulaString(formula, {
        variables: values,
        namespaces: namespacesFor(
          { ...config, statValues, skillLevels: levels, skillBonuses: bonuses },
          owner
        ),
      });
    };
  }, [config, formula, owner]);

  /** The sample values as they stand, with untouched inputs at the default */
  const currentSamples = useMemo(
    () => Object.fromEntries(inputs.map((code) => [code, samples[code] ?? DEFAULT_SAMPLE])),
    [inputs, samples]
  );

  const sampleResult = useMemo(
    () => (validation?.isValid ? evaluateAt(currentSamples) : undefined),
    [validation, evaluateAt, currentSamples]
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
          {inputs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {inputs.map((code) => (
                <div key={code} className="flex items-center gap-2">
                  <Label htmlFor={`${fieldPrefix}-${code}`} className="w-12 font-mono">
                    {code}
                  </Label>
                  <Input
                    id={`${fieldPrefix}-${code}`}
                    type="number"
                    // These boxes live inside the owning dialog's form. Enter in one would
                    // otherwise submit it, so typing a sample value would save the entity.
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault();
                    }}
                    value={currentSamples[code]}
                    onChange={(event) =>
                      setSamples((previous) => ({
                        ...previous,
                        [code]: Number(event.target.value) || 0,
                      }))
                    }
                    className="flex-1 text-sm"
                  />
                </div>
              ))}
            </div>
          )}

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
