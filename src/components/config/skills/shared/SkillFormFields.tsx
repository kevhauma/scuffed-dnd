/**
 * Shared Skill Form Fields
 *
 * Common form fields used by all skill types (code, name, description).
 *
 * **Validates: Requirements 2.2, 4.1, 5.1, 20.1-20.7, 21.1-21.5**
 */

import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { FormField } from '../../../ui/FormField/FormField';

/**
 * Every skill kind has its own form shape, and this component only ever touches `code`, `name` and
 * `description`. `FieldValues` is react-hook-form's own type for "some form" — a generic bounded on
 * the three fields fights RHF's `Path<T>` inference for no gain here.
 */
interface SkillFormFieldsProps {
  form: UseFormReturn<FieldValues>;
  isEditing: boolean;
  validateCode: (code: string) => string | true;
  codePlaceholder?: string;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
}

export function SkillFormFields({
  form,
  isEditing,
  validateCode,
  codePlaceholder = 'STR',
  namePlaceholder = 'Strength',
  descriptionPlaceholder = 'Physical power and muscle',
}: SkillFormFieldsProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <FormField
        label="3-Letter Code"
        required
        {...register('code', {
          required: 'Code is required',
          validate: validateCode,
          setValueAs: (v) => v.toUpperCase().slice(0, 3),
        })}
        placeholder={codePlaceholder}
        maxLength={3}
        disabled={isEditing}
        error={errors.code?.message}
      />

      <FormField
        label="Name"
        required
        {...register('name', { required: 'Name is required' })}
        placeholder={namePlaceholder}
        error={errors.name?.message}
      />

      <FormField
        label="Description"
        {...register('description')}
        placeholder={descriptionPlaceholder}
      />
    </>
  );
}
