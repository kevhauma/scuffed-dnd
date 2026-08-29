/**
 * Spell Form Dialog
 *
 * One entry of the compendium: its name, what casting costs, how far it reaches and what it does
 * (v4 systems/13, TICKET-SPL-01).
 *
 * **Only the name is required, and that is the source workbook talking.** Its own rows leave six
 * range cells blank, price one spell in a distance rather than a number, and carry one live `#VERW!`
 * error where an effect should be — so a form that insisted on all five would refuse to hold the
 * data it exists for. Blank is stored as blank (or as absent, for the two optional fields); nothing
 * here trims a range or invents a cost.
 *
 * **The effect box is a plain `Textarea`, not a `FormulaEditor`, and that is deliberate.** Effect
 * text becomes template text with formula placeholders in TICKET-SPL-03, at a `spell-effect`
 * attachment point that does not exist yet
 * ([v4 D4](../../../../../docs/v4.0_sheet_parity/overview.md#d4--spell-effect-text-goes-through-the-formula-engine));
 * until it does, this field holds prose that nothing parses. The standing rule — *every field a User
 * types a formula into ships a `FormulaPreview`* (TICKET-FORM-08) — lands on SPL-03 with the
 * attachment point, and shipping a preview of an expression the engine cannot yet scope would be a
 * preview that can only be wrong.
 *
 * **Validates: v4 systems/13; Requirements 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { SpellFormData } from './useSpellManager';

interface SpellFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SpellFormData>;
  onClose: () => void;
  onSave: () => void;
}

export function SpellFormDialog({
  isOpen,
  isEditing,
  form,
  onClose,
  onSave,
}: SpellFormDialogProps) {
  const descriptionId = useId();
  const effectId = useId();

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add'} Spell`}
      className="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Acid Splash"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Registered as text rather than `valueAsNumber`, so that clearing the box means
              *this ruleset does not price the spell* rather than storing a `NaN` the app's own
              importer refuses — `useSpellManager.toStoredManaCost` is the other half */}
          <FormField
            label="Mana cost"
            type="number"
            placeholder="90"
            helperText="Leave blank if the ruleset does not price this spell."
            {...register('manaCost')}
          />

          <FormField
            label="Range / time"
            placeholder="60f"
            helperText="Free text — the ruleset's own spelling, however it words it."
            {...register('rangeTime')}
          />
        </div>

        <div>
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            rows={2}
            className="w-full mt-1"
            {...register('description')}
          />
        </div>

        <div>
          <Label htmlFor={effectId}>Effect</Label>
          <Textarea
            id={effectId}
            rows={4}
            className="w-full mt-1"
            {...register('effectTemplate')}
          />
        </div>

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Spell`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
