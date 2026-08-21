/**
 * Textarea Component
 *
 * Base multi-line input with medieval styling.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, disabledStyles, errorStyles } from './Textarea.style';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show the invalid-field treatment, mirroring `Input`'s (CR-32) */
  error?: boolean;
  className?: string;
}

export function Textarea({
  error = false,
  disabled = false,
  className = '',
  rows = 4,
  ...props
}: TextareaProps) {
  const combinedClassName = [
    baseStyles,
    error ? errorStyles : '',
    disabled ? disabledStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return <textarea disabled={disabled} rows={rows} className={combinedClassName} {...props} />;
}
