/**
 * Sample Values for a Formula Preview
 *
 * The half of [`FormulaPreview`](./FormulaPreview.tsx) that is not about *drawing* anything: which
 * inputs a formula offers a box for, what those boxes currently hold, and how to evaluate at them.
 *
 * **Extracted by TICKET-SPL-03**, which added a second preview. A spell effect is prose with
 * formula placeholders in it (v4 D4), so its preview shows a resolved *sentence* rather than one
 * number and a ladder — a different rendering of exactly the same machinery. The alternative was a
 * boolean prop on `FormulaPreview` selecting between two outputs, which is a prop named after one
 * caller, or a second copy of `evaluateAt`, which is a second evaluator by another name. Both
 * previews now compute their numbers here, so neither can disagree with the other or with the
 * value at play time.
 *
 * **Validates: Concept 00 §5, §7; Requirements 3.1, 3.2, 3.3, 16.4**
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { calculateSkills } from '#shared/engine/calculators/skillCalculator';
import { evaluateFormulaString } from '#shared/engine/formula/evaluator';
import { namespacesFor } from '#shared/engine/formula/namespaces';
import { skillMemberName, statMemberName } from '#shared/engine/formula/references';
import type { FormulaOwner } from '#shared/engine/formula/scoping';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { FormulaResult, NamespacedReference } from '#shared/types/formula';

/**
 * What an unset sample box holds
 *
 * Module-local: both previews read it through {@link useFormulaSamples}, so exporting it would be
 * supported API nothing consumes (`fallow`'s finding, and `CharacterPatch`'s rule).
 */
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
 * **Accumulates across several formulas since TICKET-SPL-03**, because a template has one box per
 * input however many placeholders read it — the caller passes every reference it found, from one
 * formula or from twenty.
 *
 * @param config - The ruleset, for the dotted-spelling → abbreviation mapping
 * @param referencedVariables - The bare codes the validator found
 * @param namespacedReferences - The dotted references the validator found
 * @returns The abbreviations to offer a box for, in the order they were first seen
 */
export function previewInputs(
  config: Configuration,
  referencedVariables: readonly string[],
  namespacedReferences: readonly NamespacedReference[]
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

/** What a preview needs to draw its boxes and produce its numbers */
export interface FormulaSamples {
  /** The sample values as they stand, with untouched inputs at {@link DEFAULT_SAMPLE} */
  values: Record<string, number>;
  /** Write one box */
  setSample: (code: string, value: number) => void;
  /** A unique prefix for the boxes' element ids — two previews on one page must not collide */
  fieldPrefix: string;
  /** Evaluate one formula with every input held at the given values */
  evaluate: (formula: string, values: Record<string, number>) => FormulaResult;
}

/**
 * Own the sample boxes for a preview, and know how to evaluate at them
 *
 * **The one place either preview produces a number.** Values go in twice — as bare `variables` and
 * as `statValues` keyed by stat id — so the two spellings of the same stat read the same box.
 *
 * **Skills follow from the stats rather than getting boxes of their own** (TICKET-SKL-02). A
 * skill's level is `Σ(weight × stat) + invested`, so once the sample stats are chosen the skill
 * levels are decided too — a box for `skills.stealth` could only disagree with them. They come
 * from `calculateSkills`, the same function the sheet reads, over a character who has invested
 * nothing: a preview answers "what does this compute at these stats", and a Player's investment is
 * not a property of the ruleset being edited.
 *
 * They are supplied for **every** owner, which is safe because `namespacesFor` gates on
 * `scoping.ts` — an owner whose row has no `skills` gets no resolver for it no matter what is
 * handed in. That gate is what CR-02 turned into the truth: the `stat` row used to list `skills`,
 * so the preview vouched for a formula the sheet could never compute.
 *
 * @param config - The ruleset the formula lives in
 * @param owner - Where the formula is attached, which decides what it may resolve
 * @param inputs - The boxes to offer, from {@link previewInputs}
 * @returns The values, the writer, an id prefix and the evaluator
 */
export function useFormulaSamples(
  config: Configuration,
  owner: FormulaOwner,
  inputs: readonly string[]
): FormulaSamples {
  // Kept across edits, so refining a formula does not reset the numbers the User set up. An input
  // that has never been touched simply has no entry and reads as the default.
  const [samples, setSamples] = useState<Record<string, number>>({});

  // The boxes are generated, so their ids are too
  const fieldPrefix = useId();

  const evaluate = useCallback(
    (formula: string, values: Record<string, number>): FormulaResult => {
      const byAbbreviation = new Map(
        config.stats.map((stat) => [stat.abbreviation.toUpperCase(), stat.id])
      );

      const statValues: Record<string, FormulaResult> = {};
      for (const [code, value] of Object.entries(values)) {
        const id = byAbbreviation.get(code);
        if (id !== undefined) statValues[id] = value;
      }

      // No gear either, for the same reason there is no investment: what a Player happens to be
      // wielding is not a property of the ruleset being edited (TICKET-ITEM-01)
      const { levels, bonuses } = calculateSkills(config, statValues, UNINVESTED, NO_GEAR);
      const namespaces = namespacesFor(
        { ...config, statValues, skillLevels: levels, skillBonuses: bonuses },
        owner
      );

      return evaluateFormulaString(formula, { variables: values, namespaces });
    },
    [config, owner]
  );

  const values = useMemo(
    () => Object.fromEntries(inputs.map((code) => [code, samples[code] ?? DEFAULT_SAMPLE])),
    [inputs, samples]
  );

  const setSample = useCallback((code: string, value: number) => {
    setSamples((previous) => ({ ...previous, [code]: value }));
  }, []);

  return { values, setSample, fieldPrefix, evaluate };
}
