/**
 * Form Field Component
 *
 * Combines Label, Input, and error message into a single component.
 * Works seamlessly with React Hook Form.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { Input, type InputProps } from '../Input/Input';
import { Label } from '../Label/Label';
import { Text } from '../Text/Text';
import { inputStyles, messageStyles } from './FormField.style';

export interface FormFieldProps extends Omit<InputProps, 'error'> {
  label: string;
  /**
   * The message to show, or nothing.
   *
   * A **string**, deliberately (CR-31): the prop used to accept react-hook-form's `FieldError`
   * object too, which this rendered as `[object Object]`. Pass `errors.x?.message`, which is what
   * every call site already does.
   */
  error?: string;
  required?: boolean;
  /**
   * Guidance shown while there is no error.
   *
   * A `ReactNode` rather than a string (CR-23), because one migrated field's guidance names a
   * formula spelling and wants it monospaced. Deliberately *not* the same widening CR-31 undid on
   * `error`: this is author-written content, never a `FieldError` handed straight through.
   */
  helperText?: React.ReactNode;
  /**
   * Classes for the input itself, where `className` styles the field's wrapper.
   *
   * The one field that needs it is a formula identifier, which reads as code (CR-23). Intrinsic
   * styling still comes from `Input`; this is the caller adding to it, not replacing it.
   */
  inputClassName?: string;
}

export function FormField({
  label,
  error,
  required = false,
  helperText,
  className = '',
  inputClassName = '',
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
        className={`${inputStyles} ${inputClassName}`.trim()}
        {...inputProps}
      />
      {error && (
        <Text variant="error" className={messageStyles}>
          {error}
        </Text>
      )}
      {!error && helperText && (
        <Text variant="muted" className={messageStyles}>
          {helperText}
        </Text>
      )}
    </div>
  );
}
