/**
 * Form Field Component
 * 
 * Combines Label, Input, and error message into a single component.
 * Works seamlessly with React Hook Form.
 */

import { Label } from '../Label/Label';
import { Input, type InputProps } from '../Input/Input';
import { Text } from '../Text/Text';
import { inputStyles, messageStyles } from './FormField.style';
import type { FieldError, Merge, FieldErrorsImpl } from 'react-hook-form';

export interface FormFieldProps extends Omit<InputProps, 'error'> {
  label: string;
  error?: string | FieldError | Merge<FieldError, FieldErrorsImpl<any>> | undefined;
  required?: boolean;
  helperText?: string;
}

export function FormField({
  label,
  error,
  required = false,
  helperText,
  className = '',
  id,
  ...inputProps
}: FormFieldProps) {
  // Generate ID if not provided
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className={className}>
      <Label htmlFor={fieldId} required={required}>
        {label}
      </Label>
      <Input
        id={fieldId}
        error={!!error}
        className={inputStyles}
        {...inputProps}
      />
      {error && (
        <Text variant="error" className={messageStyles}>{error.toString()}</Text>
      )}
      {!error && helperText && (
        <Text variant="muted" className={messageStyles}>{helperText}</Text>
      )}
    </div>
  );
}
