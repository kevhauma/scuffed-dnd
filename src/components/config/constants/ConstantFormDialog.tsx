/**
 * Constant Form Dialog
 *
 * Create and edit a constant. Two fields carry rules the entity cannot enforce on its own:
 * **name** is the formula identifier (`const.<name>`), checked against the lowercase-identifier
 * pattern and for uniqueness in `useConstantManager`'s save path, and **description** is required
 * by Concept 05 — a constant nobody understands is worse than the literal it replaced.
 *
 * The name stays editable while editing on purpose: the store's update is rename-safe, so
 * re-spelling a constant re-spells every formula naming it (TICKET-REF-01).
 *
 * **Validates: Concept 05; Requirements 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { Textarea } from '../../ui/Textarea/Textarea';
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
  const displayNameId = useId();
  const nameId = useId();
  const valueId = useId();
  const unitId = useId();
  const descriptionId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Constant' : 'Add Constant'}>
      <form onSubmit={onSave} className="space-y-4">
        {/* Display name */}
        <div>
          <Label htmlFor={displayNameId} required>
            Display Name
          </Label>
          <Input
            id={displayNameId}
            {...register('displayName', { required: 'Display name is required' })}
            placeholder="e.g., Bonus divider"
            error={!!errors.displayName}
            className="w-full mt-1"
          />
          {errors.displayName && (
            <Text variant="error" as="p" className="mt-1">
              {errors.displayName.message}
            </Text>
          )}
        </div>

        {/* Formula identifier */}
        <div>
          <Label htmlFor={nameId} required>
            Formula Name
          </Label>
          <Input
            id={nameId}
            {...register('name', { required: 'Formula name is required' })}
            placeholder="e.g., bonus_divider"
            error={!!errors.name}
            className="w-full mt-1 font-mono"
          />
          {errors.name ? (
            <Text variant="error" as="p" className="mt-1">
              {errors.name.message}
            </Text>
          ) : (
            <Text variant="muted" as="p" className="mt-1">
              How formulas reach it — written as <span className="font-mono">const.name</span>.
              Renaming it re-spells every formula that uses it.
            </Text>
          )}
        </div>

        {/* Value and unit */}
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor={valueId} required>
              Value
            </Label>
            <Input
              id={valueId}
              type="number"
              step="any"
              {...register('value', {
                required: 'Value is required',
                valueAsNumber: true,
                validate: (value) => !Number.isNaN(value) || 'Value must be a number',
              })}
              error={!!errors.value}
              className="w-full mt-1"
            />
            {errors.value && (
              <Text variant="error" as="p" className="mt-1">
                {errors.value.message}
              </Text>
            )}
          </div>

          <div className="flex-1">
            <Label htmlFor={unitId}>Unit</Label>
            <Input
              id={unitId}
              {...register('unit')}
              placeholder="e.g., points"
              className="w-full mt-1"
            />
            <Text variant="muted" as="p" className="mt-1">
              Optional display suffix.
            </Text>
          </div>
        </div>

        {/* Description */}
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

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Constant'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
