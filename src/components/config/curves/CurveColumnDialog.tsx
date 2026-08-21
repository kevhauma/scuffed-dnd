/**
 * Curve Column Dialog
 *
 * Add or edit one value column: its name and, optionally, the **generator** that fills it.
 *
 * The generator is the pattern, and the cells flagged as overrides are the exceptions (Concept 00
 * §1.1). Leaving it empty is a real choice, not an omission — a hand-entered column has no
 * pattern, so regeneration leaves it alone entirely.
 *
 * A column name is a formula segment (`curve.point_buy.main(9)`), so it takes the same
 * lowercase-identifier and uniqueness rules a curve name does — enforced in `useCurveManager`,
 * scoped to the owning curve, because `main` in two curves is two different columns.
 *
 * **Validates: Concept 06; Concept 00 §1.1, §6**
 */

import { useId } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import type { Configuration } from '../../../types/config';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormulaEditor } from '../../ui/FormulaEditor/FormulaEditor';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { FormulaPreview } from '../shared/FormulaPreview';
import type { ColumnFormData } from './useCurveManager';

interface CurveColumnDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<ColumnFormData>;
  /** What a generator may name — `key` plus the ruleset's constants */
  generatorVariables: string[];
  /** The ruleset, so the preview resolves `const.*` the way regeneration will */
  config: Configuration;
  onClose: () => void;
  onSave: () => void;
}

export function CurveColumnDialog({
  isOpen,
  isEditing,
  form,
  generatorVariables,
  config,
  onClose,
  onSave,
}: CurveColumnDialogProps) {
  const nameId = useId();

  const {
    control,
    register,
    clearErrors,
    formState: { errors },
    watch,
  } = form;
  const generator = watch('generator');

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Column' : 'Add Column'}>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <Label htmlFor={nameId} required>
            Column Name
          </Label>
          <Input
            id={nameId}
            {...register('name', { required: 'Column name is required' })}
            placeholder="e.g., main"
            error={!!errors.name}
            className="w-full mt-1 font-mono"
          />
          {errors.name ? (
            <Text variant="error" as="p" className="mt-1">
              {errors.name.message}
            </Text>
          ) : (
            <Text variant="muted" as="p" className="mt-1">
              How a formula picks this column —{' '}
              <span className="font-mono">curve.name.column(x)</span>.
            </Text>
          )}
        </div>

        <div>
          <Controller
            name="generator"
            control={control}
            render={({ field }) => (
              <FormulaEditor
                label="Generator"
                value={field.value}
                onChange={(value) => {
                  // Editing clears a refusal from the previous save attempt (CR-43), the way the
                  // stat and roll dialogs do — a stale refusal under a field being fixed reads as
                  // if the fix were rejected too
                  clearErrors('generator');
                  field.onChange(value);
                }}
                availableVariables={generatorVariables}
                placeholder="e.g., 0.75 * (key + 1)"
                className="w-full"
              />
            )}
          />
          {errors.generator ? (
            <Text variant="error" as="p" className="mt-1">
              {errors.generator.message}
            </Text>
          ) : (
            <Text variant="muted" as="p" className="mt-1">
              Filled in per row, with the row's key as <span className="font-mono">key</span>. Leave
              it empty for a hand-entered column — regeneration will not touch one.
            </Text>
          )}
        </div>

        {/* The ladder sweeps `key`, so the rows read as the column this generator would write —
            the fastest way to see the progression before it overwrites a table (TICKET-FORM-09) */}
        <FormulaPreview formula={generator} owner="curve-generator" config={config} />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Column'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
