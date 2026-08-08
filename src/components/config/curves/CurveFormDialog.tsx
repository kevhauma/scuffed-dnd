/**
 * Curve Form Dialog
 *
 * Create and edit a curve's identity. The table itself is edited in place on the card — this is
 * only what the curve is called and what its input axis means.
 *
 * **name** is the formula identifier (`curve.<name>`), checked against the lowercase-identifier
 * pattern and for uniqueness in `useCurveManager`'s save path — the rule TICKET-CRV-01 could
 * enforce only at the import boundary, because there was no form to enforce it in.
 *
 * The name stays editable while editing on purpose: the store's update is rename-safe, so
 * re-spelling a curve re-spells every formula calling it (TICKET-REF-01).
 *
 * **Validates: Concept 06; Concept 00 §6**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { Textarea } from '../../ui/Textarea/Textarea';
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
  const displayNameId = useId();
  const nameId = useId();
  const keyNameId = useId();
  const descriptionId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Curve' : 'Add Curve'}>
      <form onSubmit={onSave} className="space-y-4">
        <div>
          <Label htmlFor={displayNameId} required>
            Display Name
          </Label>
          <Input
            id={displayNameId}
            {...register('displayName', { required: 'Display name is required' })}
            placeholder="e.g., Point buy"
            error={!!errors.displayName}
            className="w-full mt-1"
          />
          {errors.displayName && (
            <Text variant="error" as="p" className="mt-1">
              {errors.displayName.message}
            </Text>
          )}
        </div>

        <div>
          <Label htmlFor={nameId} required>
            Formula Name
          </Label>
          <Input
            id={nameId}
            {...register('name', { required: 'Formula name is required' })}
            placeholder="e.g., point_buy"
            error={!!errors.name}
            className="w-full mt-1 font-mono"
          />
          {errors.name ? (
            <Text variant="error" as="p" className="mt-1">
              {errors.name.message}
            </Text>
          ) : (
            <Text variant="muted" as="p" className="mt-1">
              How formulas reach it — written as <span className="font-mono">curve.name(x)</span>.
              Renaming it re-spells every formula that calls it.
            </Text>
          )}
        </div>

        <div>
          <Label htmlFor={keyNameId} required>
            Input Axis
          </Label>
          <Input
            id={keyNameId}
            {...register('keyName', { required: 'Input axis is required' })}
            placeholder="e.g., points"
            error={!!errors.keyName}
            className="w-full mt-1"
          />
          {errors.keyName ? (
            <Text variant="error" as="p" className="mt-1">
              {errors.keyName.message}
            </Text>
          ) : (
            <Text variant="muted" as="p" className="mt-1">
              What the number you look the table up by is called.
            </Text>
          )}
        </div>

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

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Save Changes' : 'Add Curve'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
