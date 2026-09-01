/**
 * Passive Form Dialog
 *
 * One entry of the catalog: its name and what it does (v4 systems/14, TICKET-PAS-01).
 *
 * **Two fields, because the source tab has two columns.** There is no cost, duration, category or
 * prerequisite in the workbook's `Background refernces abilities: passive` table, so there is no
 * input for one — and nothing grants a passive automatically, which is the reason there is no
 * *source* field either (overview D5). Only the name is required; a passive somebody has named and
 * not yet described is a row worth keeping.
 *
 * **The effect box is a `Textarea` with a preview**, `SpellFormDialog`'s shape and for its exact
 * reasoning: the field is **not a formula** but prose with `{placeholders}` in it, so a
 * `FormulaEditor` pointed at it would report every English word as an undefined variable. What the
 * standing rule requires — never a formula field without a window onto what it computes
 * (TICKET-FORM-08) — is met by {@link TemplatePreview}, which resolves per placeholder.
 *
 * The owner is **`FORMULA_OWNER.SPELL_EFFECT`** rather than a new attachment point, which is the
 * ticket's own instruction (*"its own `FormulaOwner` if the reference set differs; reuse if not"*):
 * the two templated passives read a skill level, which is the same reference set a spell effect
 * sees, so a second row in `scoping.ts` would say the same thing under a different name.
 *
 * **Validates: v4 systems/14; v4 D4; Requirements 16.4, 21.1-21.5**
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
import type { PassiveFormData } from './usePassiveManager';

interface PassiveFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<PassiveFormData>;
  /** The ruleset the placeholders are scoped against */
  config: Configuration;
  onClose: () => void;
  onSave: () => void;
}

export function PassiveFormDialog({
  isOpen,
  isEditing,
  form,
  config,
  onClose,
  onSave,
}: PassiveFormDialogProps) {
  const effectId = useId();

  const {
    register,
    watch,
    formState: { errors },
  } = form;

  // Watched rather than read once: the preview is the point of the field, and one that updated on
  // blur would answer a question the User had already stopped asking
  const effectText = watch('effectText');

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add'} Passive Ability`}
      className="max-w-2xl"
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Blindsight"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <div>
          <Label htmlFor={effectId}>Effect</Label>
          <Textarea
            id={effectId}
            rows={4}
            placeholder="You have blindsight out to {skills.perception.level * 10} feet"
            className="w-full mt-1"
            {...register('effectText')}
          />
          <Text variant="caption" as="p" className="mt-1">
            Prose, with a formula in braces wherever a number is computed — an unclosed brace is
            just text.
          </Text>
          <TemplatePreview
            template={effectText}
            owner={FORMULA_OWNER.SPELL_EFFECT}
            config={config}
            className="mt-2"
          />
        </div>

        <FormDialogActions
          submitLabel={`${isEditing ? 'Update' : 'Add'} Passive`}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
