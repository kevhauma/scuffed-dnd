import React from 'react';
import { baseStyles, requiredStyles } from './Label.style';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Label({
  required = false,
  children,
  className = '',
  ...props
}: LabelProps) {
  const combinedClassName = [
    baseStyles,
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={combinedClassName} {...props}>
      {children}
      {required && <span className={requiredStyles}>*</span>}
    </label>
  );
}
