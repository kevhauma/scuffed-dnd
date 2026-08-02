/**
 * Checkbox Component
 *
 * Base checkbox with medieval styling.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { checkboxStyles, disabledStyles, labelStyles } from './Checkbox.style';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  className?: string;
}

export function Checkbox({ label, disabled = false, className = '', ...props }: CheckboxProps) {
  const checkboxClassName = [checkboxStyles, disabled ? disabledStyles : '']
    .filter(Boolean)
    .join(' ');

  const containerClassName = [
    'inline-flex items-center gap-2',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={containerClassName}>
      <input type="checkbox" disabled={disabled} className={checkboxClassName} {...props} />
      {label && <span className={labelStyles}>{label}</span>}
    </label>
  );
}
