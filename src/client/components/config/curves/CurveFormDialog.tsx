/**
 * Curve Form Dialog
 *
 * Create and edit a curve's identity. The table itself is edited in place on the card — this is
 * only what the curve is called and what its input axis means.
 *
 * **name** is the formula identifier (`curve.<name>`), checked against the lowercase-identifier
 * pattern in `useCurveManager`'s save path and for uniqueness by the store (CR-17) — the rule
 * TICKET-CRV-01 could enforce only at the import boundary, because there was no form to enforce
 * it in.
 *
 * The name stays editable while editing on purpose: the store's update is rename-safe, so
 * re-spelling a curve re-spells every formula calling it (TICKET-REF-01).
 *
 * On `FormField` and `FormDialogActions` since CR-23; the description keeps its own `Label` +
 * `Textarea`, since `FormField` renders a single-line `Input`.
 *
 * **Validates: Concept 06; Concept 00 §6**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { CurveFormData } from './useCurveManager';

interface CurveFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<CurveFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function CurveFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: CurveFormDialogProps) {
  const descriptionId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Curve' : 'Add Curve'}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Display Name"
          required
          placeholder="e.g., Point buy"
          error={errors.displayName?.message}
          {...register('displayName', { required: 'Display name is required' })}
        />

        <FormField
          label="Formula Name"
          required
          placeholder="e.g., point_buy"
          error={errors.name?.message}
          helperText={
            <>
              How formulas reach it — written as <span className="font-mono">curve.name(x)</span>.
              Renaming it re-spells every formula that calls it.
            </>
          }
          inputClassName="font-mono"
          {...register('name', { required: 'Formula name is required' })}
        />

        <FormField
          label="Input Axis"
          required
          placeholder="e.g., points"
          error={errors.keyName?.message}
          helperText="What the number you look the table up by is called."
          {...register('keyName', { required: 'Input axis is required' })}
        />

        <div>
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            {...register('description')}
            placeholder="What this progression governs"
            rows={3}
            className="w-full mt-1"
          />
        </div>

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Curve'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
