import React from 'react';
import { baseStyles, errorStyles, disabledStyles } from './Input.style';

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

  return (
    <input
      type={type}
      disabled={disabled}
      className={combinedClassName}
      {...props}
    />
  );
}
