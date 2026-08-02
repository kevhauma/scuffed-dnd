/**
 * Input Component
 *
 * Base text/number input with medieval styling.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, disabledStyles, errorStyles } from './Input.style';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: boolean;
  className?: string;
}

export function Input({
  error = false,
  disabled = false,
  className = '',
  type = 'text',
  ...props
}: InputProps) {
  const combinedClassName = [
    baseStyles,
    error ? errorStyles : '',
    disabled ? disabledStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return <input type={type} disabled={disabled} className={combinedClassName} {...props} />;
}
