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
 * **The effect box stays a `Textarea` and gains a preview** (TICKET-SPL-03). SPL-01 left it a plain
 * box because the `spell-effect` attachment point did not exist yet and a preview of an expression
 * the engine could not scope would be a preview that can only be wrong; the point exists now, so
 * the standing rule — *every field a User types a formula into ships a preview* (TICKET-FORM-08) —
 * is paid here.
 *
 * It is a `Textarea` rather than a `FormulaEditor` because the field is **not a formula**: it is
 * prose with `{placeholders}` in it (v4 D4), and `FormulaEditor` validates its whole value as one
 * expression — pointed at a sentence it would report every English word as an undefined variable.
 * The preview does the splitting, and the rule's real requirement — never a formula field without a
 * window onto what it computes — is met by {@link TemplatePreview}.
 *
 * **Validates: v4 systems/13; v4 D4; Requirements 16.4, 21.1-21.5**
 */

import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { FORMULA_OWNER } from '#shared/engine/formula/scoping';
import type { Configuration } from '#shared/types/config';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import { TemplatePreview } from '../shared/TemplatePreview';
import type { SpellFormData } from './useSpellManager';

interface SpellFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<SpellFormData>;
  /** The ruleset the placeholders are scoped against */
  config: Configuration;
  onClose: () => void;
  onSave: () => void;
}

export function SpellFormDialog({
  isOpen,
  isEditing,
  form,
  config,
  onClose,
  onSave,
}: SpellFormDialogProps) {
  const descriptionId = useId();
  const effectId = useId();

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  // Watched rather than read once: the preview is the point of the field, and a preview that
  // updated on blur would answer a question the User had already stopped asking
  const effectTemplate = watch('effectTemplate');

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
            placeholder="A {WIS}-foot-radius sphere takes {skills.fire.bonus} fire damage"
            className="w-full mt-1"
            {...register('effectTemplate')}
          />
          <Text variant="caption" as="p" className="mt-1">
            Prose, with a formula in braces wherever a number is computed — an unclosed brace is
            just text.
          </Text>
          <TemplatePreview
            template={effectTemplate}
            owner={FORMULA_OWNER.SPELL_EFFECT}
            config={config}
            className="mt-2"
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
