/**
 * Roll Definition Form Dialog
 *
 * A roll is an input expression plus a ladder (Concept 08), and this is that and nothing else —
 * conspicuously, there are no dice-count boxes. That is the entity's argument: `CombatSkillFormDialog`
 * asks for six counts *and* a formula, which is a pool that cannot be derived from the character.
 *
 * The input renders `FormulaPreview` at the `roll-input` attachment point, per CLAUDE.md's standing
 * rule that every User-authored formula field ships a preview.
 *
 * **Validates: Concept 08; Requirements 16.4, 21.1-21.5**
 */

import { useId } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import type { Configuration, DiceLadder, RollCategory } from '../../../types';
import { ROLL_CATEGORIES } from '../../../types';
import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { FormulaEditor } from '../../ui/FormulaEditor/FormulaEditor';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { FormulaPreview } from '../shared/FormulaPreview';

interface RollFormData {
  name: string;
  description: string;
  input: string;
  ladderId: string;
  category: RollCategory | '';
}

export interface RollDefinitionFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<RollFormData>;
  /** The ruleset's ladders — a roll must name one of these */
  availableLadders: DiceLadder[];
  /** Stat abbreviations, for the input editor's autocomplete */
  availableSkillCodes: string[];
  /** The ruleset, so the preview scopes and resolves the way the saved formula will */
  config: Configuration;
  onClose: () => void;
  onSave: () => void;
}

/** "No category" is a real answer (Concept 08), so it is an option rather than a blank */
const CATEGORY_OPTIONS = [
  { value: '', label: 'Uncategorised' },
  ...ROLL_CATEGORIES.map((category) => ({
    value: category,
    label: category.charAt(0).toUpperCase() + category.slice(1),
  })),
];

export function RollDefinitionFormDialog({
  isOpen,
  isEditing,
  form,
  availableLadders,
  availableSkillCodes,
  config,
  onClose,
  onSave,
}: RollDefinitionFormDialogProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = form;
  const input = watch('input');
  const ladderId = useId();
  const categoryId = useId();

  return (
    <Dialog open={isOpen} onClose={onClose} title={`${isEditing ? 'Edit' : 'Add'} Roll`}>
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Melee"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="What this roll is for"
          {...register('description')}
        />

        <div>
          <Label htmlFor={ladderId}>Dice Ladder</Label>
          <Select
            id={ladderId}
            className="w-full mt-1"
            // The empty option is what `handleAdd` selects when there is more than one ladder;
            // without it the select renders blank with nothing telling the User to choose
            options={[
              { value: '', label: 'Select a dice ladder' },
              ...availableLadders.map((ladder) => ({
                value: ladder.id,
                label: `${ladder.name} — ${ladder.dieSizes.join(' | ')}`,
              })),
            ]}
            {...register('ladderId', { required: 'A roll needs a ladder to decompose down' })}
          />
          {errors.ladderId && (
            <Text variant="error" as="p" className="mt-1">
              {errors.ladderId.message}
            </Text>
          )}
        </div>

        <div>
          <Label htmlFor={categoryId}>Category</Label>
          <Select
            id={categoryId}
            className="w-full mt-1"
            options={CATEGORY_OPTIONS}
            {...register('category')}
          />
        </div>

        <Controller
          name="input"
          control={control}
          render={({ field }) => (
            <FormulaEditor
              label="Input"
              value={field.value}
              onChange={(value) => {
                // Editing clears a refusal from the previous save attempt
                form.clearErrors('input');
                field.onChange(value);
              }}
              availableVariables={availableSkillCodes}
              placeholder="stats.dexterity + skills.dodging.bonus"
              className="w-full"
            />
          )}
        />
        {errors.input && (
          <Text variant="error" as="p" className="mt-1">
            {errors.input.message}
          </Text>
        )}

        <FormulaPreview formula={input} owner="roll-input" config={config} />

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Roll
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
