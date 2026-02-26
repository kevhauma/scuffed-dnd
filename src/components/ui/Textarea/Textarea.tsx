import React from 'react';
import { baseStyles, disabledStyles } from './Textarea.style';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export function Textarea({
  disabled = false,
  className = '',
  rows = 4,
  ...props
}: TextareaProps) {
  const combinedClassName = [
    baseStyles,
    disabled ? disabledStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <textarea
      disabled={disabled}
      rows={rows}
      className={combinedClassName}
      {...props}
    />
  );
}
