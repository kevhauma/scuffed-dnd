/**
 * Constant Form Dialog
 *
 * Create and edit a constant. Two fields carry rules the entity cannot enforce on its own:
 * **name** is the formula identifier (`const.<name>`), checked against the lowercase-identifier
 * pattern in `useConstantManager`'s save path and for uniqueness by the store (CR-17), and
 * **description** is required by Concept 05 — a constant nobody understands is worse than the
 * literal it replaced.
 *
 * The name stays editable while editing on purpose: the store's update is rename-safe, so
 * re-spelling a constant re-spells every formula naming it (TICKET-REF-01).
 *
 * On `FormField` and `FormDialogActions` since CR-23; the description keeps its own `Label` +
 * `Textarea`, since `FormField` renders a single-line `Input`.
 *
 * **Validates: Concept 05; Requirements 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { ConstantFormData } from './useConstantManager';

interface ConstantFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<ConstantFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function ConstantFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: ConstantFormDialogProps) {
  const descriptionId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Constant' : 'Add Constant'}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Display Name"
          required
          placeholder="e.g., Bonus divider"
          error={errors.displayName?.message}
          {...register('displayName', { required: 'Display name is required' })}
        />

        <FormField
          label="Formula Name"
          required
          placeholder="e.g., bonus_divider"
          error={errors.name?.message}
          helperText={
            <>
              How formulas reach it — written as <span className="font-mono">const.name</span>.
              Renaming it re-spells every formula that uses it.
            </>
          }
          inputClassName="font-mono"
          {...register('name', { required: 'Formula name is required' })}
        />

        <div className="flex gap-4">
          <FormField
            label="Value"
            required
            type="number"
            step="any"
            className="flex-1"
            error={errors.value?.message}
            {...register('value', {
              required: 'Value is required',
              valueAsNumber: true,
              validate: (value) => !Number.isNaN(value) || 'Value must be a number',
            })}
          />

          <FormField
            label="Unit"
            placeholder="e.g., points"
            className="flex-1"
            helperText="Optional display suffix."
            {...register('unit')}
          />
        </div>

        <div>
          <Label htmlFor={descriptionId} required>
            Description
          </Label>
          <Textarea
            id={descriptionId}
            {...register('description', { required: 'Description is required' })}
            placeholder="What this lever does, and what turning it changes"
            rows={3}
            className="w-full mt-1"
          />
          {errors.description && (
            <Text variant="error" as="p" className="mt-1">
              {errors.description.message}
            </Text>
          )}
        </div>

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Constant'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
