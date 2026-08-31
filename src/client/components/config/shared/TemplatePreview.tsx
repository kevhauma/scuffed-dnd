/**
 * Template Preview
 *
 * What a spell effect actually *reads* while the User is still writing it (TICKET-SPL-03) —
 * `FormulaPreview`'s counterpart for a field that is prose with formulas in it rather than one
 * formula.
 *
 * ## Why a second component rather than a flag on the first
 *
 * The two answer different questions and therefore draw different things. A formula preview shows
 * **one number** and a ladder sweeping it across nine levels, because *is this formula roughly the
 * right size* is what a User asks of `STR * 0.2 + CHA * 0.1`. A template preview shows **one
 * sentence**, because what a User asks of *"a {x}-foot-radius sphere takes {y} fire damage"* is
 * whether it reads correctly — and nine of those sentences stacked in a table answers nothing that
 * one does not. A boolean prop selecting between the two renderings would be a prop named after one
 * caller, which is exactly what the house rules refuse.
 *
 * **What they share is shared**, which is the part that matters: the sample boxes, the skill
 * derivation and the evaluation all come from
 * [`formulaSamples.ts`](./formulaSamples.ts), so there is no second evaluator and the two previews
 * cannot disagree about what a stat at 10 gives.
 *
 * **This is the extension TICKET-FORM-08's standing rule anticipated** — *if the preview cannot
 * express what the field needs, extend the component and note it on FORM-08*. Noted there.
 *
 * ## The validation is per placeholder, and it has to be
 *
 * `{stats.wisdom}` is a formula; *"a 55-foot-radius sphere centered on"* is not. Handing the whole
 * template to `validateFormula` would report every English word as an undefined variable, which is
 * why the split lives in `template.ts` and this component never sees the prose as anything but
 * text.
 *
 * **Validates: v4 systems/13 gap 4; v4 D4; Requirements 16.4, 16.6, 21.1-21.5**
 */

import { useMemo } from 'react';
import type { FormulaOwner } from '#shared/engine/formula/scoping';
import { scopeFor } from '#shared/engine/formula/scoping';
import type { ResolvedSegment } from '#shared/engine/formula/template';
import { parseTemplate, templateFormulas } from '#shared/engine/formula/template';
import { validateFormula } from '#shared/engine/formula/validator';
import type { Configuration } from '#shared/types/config';
import type { NamespacedReference } from '#shared/types/formula';
import { ResolvedTemplate } from '../../shared/ResolvedTemplate';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { previewInputs, useFormulaSamples } from './formulaSamples';
import { SampleInputs } from './SampleInputs';

export interface TemplatePreviewProps {
  /** The template as the User has it now — mid-edit and half-typed is expected, not exceptional */
  template: string;
  /** Where its placeholders are attached, which decides what they may reference */
  owner: FormulaOwner;
  /** The ruleset the template lives in */
  config: Configuration;
  className?: string;
}

export function TemplatePreview({ template, owner, config, className = '' }: TemplatePreviewProps) {
  const scope = useMemo(() => scopeFor(config, owner), [config, owner]);

  const placeholders = useMemo(() => templateFormulas(template), [template]);

  /**
   * Every placeholder's verdict, and the references the valid ones make
   *
   * One pass rather than two: the errors go on screen and the references decide which boxes to
   * offer, and a placeholder that does not validate contributes neither a box nor a number.
   */
  const checked = useMemo(() => {
    const errors: string[] = [];
    const variables: string[] = [];
    const references: NamespacedReference[] = [];

    for (const source of placeholders) {
      const validation = validateFormula(source, scope.codes, scope);

      if (!validation.isValid) {
        // The placeholder is quoted because a sentence with three of them has to say which
        errors.push(`{${source}}: ${validation.errors.join(' ')}`);
        continue;
      }

      variables.push(...validation.referencedVariables);
      references.push(...validation.namespacedReferences);
    }

    return { errors, variables, references };
  }, [placeholders, scope]);

  const inputs = useMemo(
    () => previewInputs(config, checked.variables, checked.references),
    [config, checked]
  );

  const { values, setSample, fieldPrefix, evaluate } = useFormulaSamples(config, owner, inputs);

  /**
   * The template with every placeholder filled in at the current sample values
   *
   * Resolved here rather than through `resolveTemplate` because the numbers have to come from the
   * *preview's* boxes, and `useFormulaSamples.evaluate` is what knows about those. It is the same
   * engine call either way — `evaluate` ends in `evaluateFormulaString`, exactly as
   * `resolveTemplate` does — so this is one context differing, not one evaluator differing.
   */
  const resolved = useMemo((): ResolvedSegment[] => {
    const segments = parseTemplate(template);

    return segments.map((segment) => {
      if (segment.kind === 'text') return segment;

      const result = evaluate(segment.source, values);

      return { kind: 'formula', source: segment.source, result };
    });
  }, [template, evaluate, values]);

  // Nothing to preview: no placeholder means the field is plain prose, which needs no window onto
  // itself. 92 of the workbook's 418 effects are exactly that.
  if (placeholders.length === 0) return null;

  return (
    <Card variant="bordered" className={`p-4 ${className}`.trim()}>
      <Text variant="body-small-secondary" as="p" className="mb-3">
        Preview
      </Text>

      <SampleInputs
        inputs={inputs}
        values={values}
        onChange={setSample}
        fieldPrefix={fieldPrefix}
      />

      {checked.errors.length > 0 && (
        <Text variant="error" as="p" className="mb-3">
          {checked.errors.join(' ')}
        </Text>
      )}

      <div className="rounded border border-forest bg-forest/10 p-2">
        <ResolvedTemplate segments={resolved} />
      </div>
    </Card>
  );
}
