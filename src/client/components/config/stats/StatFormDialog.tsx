/**
 * Stat Form Dialog
 *
 * The whole unified stat in one form (TICKET-STAT-02): identity, the two flags, the optional
 * clamp, rounding, and the optional formula that makes the stat derived.
 *
 * The form does not carry a "derived" switch, because there is nothing to switch: a formula is
 * present or it is not, and that *is* the distinction (Concept 01). What the dialog does instead
 * is say out loud which of the two the User is currently editing, so "why can't I put points into
 * this?" is answered before it is asked.
 *
 * **Validates: Concept 01; Requirements 3.1, 3.2, 3.3, 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { Configuration } from '#shared/types/config';
import { Checkbox } from '../../ui/Checkbox/Checkbox';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormulaEditor } from '../../ui/FormulaEditor/FormulaEditor';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { FormDialogActions } from '../shared/FormDialogActions';
import { FormulaPreview } from '../shared/FormulaPreview';
import type { StatFormData } from './useStatManager';
import { ROUNDING_OPTIONS } from './useStatManager';

export interface StatFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<StatFormData>;
  availableSkillCodes: string[];
  /** The ruleset, so the preview scopes and resolves the way the saved formula will */
  config: Configuration;
  /** True while the formula field holds something — the stat is derived rather than invested */
  isDerived: boolean;
  /** Non-blocking notes about the combination being edited; the save still goes through */
  warnings: string[];
  onClose: () => void;
  onSave: () => void;
}

export function StatFormDialog({
  isOpen,
  isEditing,
  form,
  availableSkillCodes,
  config,
  isDerived,
  warnings,
  onClose,
  onSave,
}: StatFormDialogProps) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = form;
  const formulaValue = watch('formula');
  // `Select` is not a `FormField`, so the label association is this component's to make
  const roundingId = useId();

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Stat`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Health"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Abbreviation"
          required
          placeholder="HP"
          helperText="How formulas spell this stat. Shared with the skill codes, so it must be unique."
          error={errors.abbreviation?.message}
          {...register('abbreviation', { required: 'Abbreviation is required' })}
        />

        <FormField
          label="Description"
          placeholder="Character's life force"
          {...register('description')}
        />

        <div className="flex flex-col gap-2">
          <Checkbox
            label="Counts toward the character's stat total"
            {...register('countsTowardTotal')}
          />
          <Checkbox
            label="Is a resource — the value is a maximum the character spends against"
            {...register('isResource')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            label="Minimum"
            type="number"
            placeholder="unbounded"
            helperText="Leave empty for no lower bound"
            {...register('min')}
          />
          <FormField
            label="Maximum"
            type="number"
            placeholder="unbounded"
            helperText="Leave empty for no upper bound"
            {...register('max')}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor={roundingId}>Rounding</Label>
            <Select id={roundingId} options={ROUNDING_OPTIONS} {...register('rounding')} />
          </div>
        </div>

        <FormulaEditor
          label="Formula (leave empty for an invested stat)"
          value={formulaValue}
          onChange={(value) => {
            // Editing clears a refusal from the previous save attempt
            form.clearErrors('formula');
            setValue('formula', value);
          }}
          availableVariables={availableSkillCodes}
          placeholder="e.g., STR * 10 + CON * 5"
          className="w-full mb-2"
        />
        {errors.formula && (
          <Text variant="error" as="p" className="mt-1">
            {errors.formula.message}
          </Text>
        )}

        {/* Live, and scoped exactly as the saved formula will be — so what the User reads here is
            what the sheet will compute (TICKET-FORM-08) */}
        <FormulaPreview formula={formulaValue} owner="stat" config={config} />

        {/* Which of the two kinds of stat this is — said, not switched */}
        <div className="p-3 bg-parchment-100 border border-stone-200 rounded">
          <Text variant="body-small">
            {isDerived
              ? 'Derived: this stat accepts no invested points — its value is the formula above, plus nothing else.'
              : 'Invested: this stat takes points, plus its race base and equipment bonuses.'}
          </Text>
        </div>

        {warnings.length > 0 && (
          <div className="p-3 bg-amber/10 border border-amber rounded">
            {warnings.map((warning) => (
              <Text key={warning} variant="body-small" as="p" className="text-ink-700">
                {warning}
              </Text>
            ))}
          </div>
        )}

        {/* Actions */}
        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Stat`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
