/**
 * Race Form Dialog
 * 
 * Form for adding/editing races with skill modifier editor.
 */

import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Button } from '../../ui/Button/Button';
import { FormField } from '../../ui/FormField/FormField';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Select } from '../../ui/Select/Select';
import { Input } from '../../ui/Input/Input';
import { Text } from '../../ui/Text/Text';
import type { MainSkill, SkillModifier } from '../../../types';

interface RaceFormData {
  name: string;
  description: string;
  skillModifiers: SkillModifier[];
}

interface RaceFormDialogProps {
  isOpen: boolean;
  isEditing: boolean;
  form: UseFormReturn<RaceFormData>;
  availableMainSkills: MainSkill[];
  onClose: () => void;
  onSave: () => void;
}

export function RaceFormDialog({
  isOpen,
  isEditing,
  form,
  availableMainSkills,
  onClose,
  onSave,
}: RaceFormDialogProps) {
  const { register, formState: { errors }, watch, setValue } = form;
  const skillModifiers = watch('skillModifiers');

  const [selectedSkillCode, setSelectedSkillCode] = useState('');
  const [modifierValue, setModifierValue] = useState(0);

  // Get available skills that haven't been added yet
  const availableSkills = availableMainSkills.filter(
    skill => !skillModifiers.some(m => m.skillCode === skill.code)
  );

  const handleAddModifier = () => {
    if (!selectedSkillCode) return;
    
    const newModifiers = [
      ...skillModifiers,
      { skillCode: selectedSkillCode, modifier: modifierValue }
    ];
    setValue('skillModifiers', newModifiers);
    setSelectedSkillCode('');
    setModifierValue(0);
  };

  const handleRemoveModifier = (index: number) => {
    const newModifiers = skillModifiers.filter((_, i) => i !== index);
    setValue('skillModifiers', newModifiers);
  };

  const handleUpdateModifier = (index: number, newValue: number) => {
    const newModifiers = [...skillModifiers];
    newModifiers[index] = { ...newModifiers[index], modifier: newValue };
    setValue('skillModifiers', newModifiers);
  };

  // Get skill name from code
  const getSkillName = (code: string) => {
    const skill = availableMainSkills.find(s => s.code === code);
    return skill ? skill.name : code;
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      title={`${isEditing ? 'Edit' : 'Add'} Race`}
    >
      <form onSubmit={onSave} className="space-y-4">
        <FormField
          label="Name"
          required
          placeholder="Elf"
          error={errors.name?.message}
          {...register('name', { required: 'Name is required' })}
        />

        <FormField
          label="Description"
          placeholder="Graceful and long-lived beings"
          {...register('description')}
        />

        {/* Skill Modifiers Section */}
        <div className="space-y-3">
          <Text variant="body-small" className="font-semibold">Skill Modifiers</Text>
          
          {/* Add Modifier Controls */}
          {availableSkills.length > 0 && (
            <div className="p-3 bg-parchment-100 rounded space-y-2">
              <Text variant="body-small-secondary">Add Modifier:</Text>
              <div className="flex gap-2">
                <Select
                  value={selectedSkillCode}
                  onChange={(e) => setSelectedSkillCode(e.target.value)}
                  options={[
                    { value: '', label: 'Select skill...' },
                    ...availableSkills.map(skill => ({
                      value: skill.code,
                      label: `${skill.name} (${skill.code})`
                    }))
                  ]}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={modifierValue}
                  onChange={(e) => setModifierValue(Number(e.target.value))}
                  placeholder="±0"
                  className="w-24"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddModifier}
                  disabled={!selectedSkillCode}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Current Modifiers List */}
          {skillModifiers.length === 0 ? (
            <div className="p-3 bg-parchment-50 rounded">
              <Text variant="body-small-secondary">
                No skill modifiers added yet. Add modifiers to define racial bonuses and penalties.
              </Text>
            </div>
          ) : (
            <div className="space-y-2">
              {skillModifiers.map((modifier, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 p-2 bg-parchment-50 rounded"
                >
                  <Text variant="body-small" className="flex-1">
                    {getSkillName(modifier.skillCode)}
                  </Text>
                  <Input
                    type="number"
                    value={modifier.modifier}
                    onChange={(e) => handleUpdateModifier(index, Number(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleRemoveModifier(index)}
                    className="text-sm px-2 py-1"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {availableSkills.length === 0 && skillModifiers.length > 0 && (
            <Text variant="body-small-secondary" className="text-center">
              All available main skills have modifiers assigned.
            </Text>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {isEditing ? 'Update' : 'Add'} Race
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
