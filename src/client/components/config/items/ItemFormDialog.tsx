/**
 * Item Form Dialog Component
 *
 * Dialog for creating and editing item **templates** — what a thing is, where it is worn, and what
 * wielding it does to the bearer's skills.
 *
 * The text fields are on `FormField` and the footer on `FormDialogActions` since CR-23. The
 * pickers and the description stay hand-built: `FormField` renders an `Input`, which a `Select`
 * and a `Textarea` are not.
 *
 * **The skill vector is the same rows block every other bonus list uses** (TICKET-ITEM-01) — sparse
 * and chosen, so a template names the eight skills it moves rather than all 48. `ValueRowsField`
 * takes options rather than stats precisely so this dialog can offer skills.
 *
 * **The material pair is gone** (TICKET-INV-05). This dialog picked a material and then a tier of
 * it, which made the catalog the cross-product of every template and every metal — the fused-instance
 * reading v4.0 retires. What a thing is made of is chosen when a Player *builds* one, so that picker
 * belongs to TICKET-INV-06's builder rather than to the ruleset's catalog.
 *
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 21.1-21.5; v4 systems/11, systems/12**
 */

import { useId } from 'react';
import { type UseFormReturn, useFieldArray } from 'react-hook-form';
import type { EquipmentSlot } from '#shared/types';
import { Dialog } from '../../ui/Dialog/Dialog';
import { FormField } from '../../ui/FormField/FormField';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { Textarea } from '../../ui/Textarea/Textarea';
import { FormDialogActions } from '../shared/FormDialogActions';
import type { RowOption } from '../shared/ValueRowsField';
import { ValueRowsField } from '../shared/ValueRowsField';
import type { ItemFormData } from './useItemManager';

interface ItemFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<ItemFormData>;
  equipmentSlots: EquipmentSlot[];
  /** The skills a bonus row may name — every skill the ruleset defines */
  skillOptions: RowOption[];
  onClose: () => void;
  onSave: () => void;
}

export function ItemFormDialog({
  isOpen,
  isEditing,
  form,
  equipmentSlots,
  skillOptions,
  onClose,
  onSave,
}: ItemFormDialogProps) {
  const itemDescriptionId = useId();
  const itemEquipmentSlotId = useId();

  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'skillBonuses' });

  const handleAddBonus = () => {
    const firstSkillId = skillOptions[0]?.value ?? '';
    append({ skillId: firstSkillId, modifier: 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} title={isEditing ? 'Edit Item' : 'Add Item'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField
          label="Name"
          required
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <div>
          <Label htmlFor={itemDescriptionId}>Description</Label>
          <Textarea
            id={itemDescriptionId}
            {...register('description')}
            rows={3}
            className="w-full mt-1"
          />
        </div>

        <FormField
          label="Category (optional)"
          placeholder="e.g., Weapons, Armor, Consumables"
          {...register('categoryId')}
        />

        {/* The shop is the User's own word, like the category above it: the workbook's nine names
            are what its catalog happens to say, not a list this form offers */}
        <FormField
          label="Shop (optional)"
          placeholder="e.g., Imperial Forge, General Store"
          {...register('shop')}
        />

        <div>
          <Label htmlFor={itemEquipmentSlotId}>Equipment Slot (optional)</Label>
          <Select
            id={itemEquipmentSlotId}
            {...register('equipmentSlotType')}
            options={[
              { value: '', label: 'None (Miscellaneous)' },
              ...equipmentSlots.map((s) => ({ value: s.type, label: s.name })),
            ]}
            className="w-full mt-1"
          />
        </div>

        <ValueRowsField
          title="Skill Bonuses/Penalties"
          addLabel="Add Skill Bonus"
          onAdd={handleAddBonus}
          options={skillOptions}
          targetLabel="Skill"
          rows={fields}
          onRemove={remove}
          registerTarget={(index) => register(`skillBonuses.${index}.skillId` as const)}
          registerValue={(index) =>
            register(`skillBonuses.${index}.modifier`, { valueAsNumber: true })
          }
          rowNoun="skill bonus"
          valueLabel="Modifier"
          valuePlaceholder="Modifier (+ or -)"
        >
          {skillOptions.length === 0 && (
            <Text variant="body-small-secondary" className="italic">
              This ruleset defines no skills yet, so there is nothing an item can make you better
              at. Add skills first.
            </Text>
          )}

          {fields.length === 0 && skillOptions.length > 0 && (
            <Text variant="body-small-secondary" className="italic">
              No skill bonuses. Click 'Add Skill Bonus' to say what wielding this changes — a
              Battleaxe helps with Athletics and hinders Sneaking. Only the skills it moves are
              stored; a bonus of 0 is dropped.
            </Text>
          )}
        </ValueRowsField>

        <FormDialogActions
          submitLabel={isEditing ? 'Save Changes' : 'Add Item'}
          onCancel={onClose}
        />
      </form>
    </Dialog>
  );
}
