/**
 * Label Component
 *
 * Base form label, optionally marked required.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, requiredStyles } from './Label.style';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Label({ required = false, children, className = '', ...props }: LabelProps) {
  const combinedClassName = [
    baseStyles,
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // A base primitive cannot nest the control it labels — the caller owns both, and every call
    // site passes `htmlFor` (spread through `props`) pointing at its own input. The rule cannot see
    // across that boundary, so it is suppressed here rather than at ~20 call sites.
    // biome-ignore lint/a11y/noLabelWithoutControl: association is the caller's htmlFor, which this component cannot see
    <label className={combinedClassName} {...props}>
      {children}
      {required && <span className={requiredStyles}>*</span>}
    </label>
  );
}
