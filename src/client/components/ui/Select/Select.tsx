/**
 * Select Component
 *
 * Base dropdown with medieval styling.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, disabledStyles, errorStyles } from './Select.style';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Show the invalid-field treatment, mirroring `Input`'s (CR-32) */
  error?: boolean;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  error = false,
  options,
  placeholder,
  disabled = false,
  className = '',
  ...props
}: SelectProps) {
  const combinedClassName = [
    baseStyles,
    error ? errorStyles : '',
    disabled ? disabledStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select disabled={disabled} className={combinedClassName} {...props}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
