import React from 'react';
import { baseStyles, disabledStyles } from './Select.style';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function Select({
  options,
  placeholder,
  disabled = false,
  className = '',
  ...props
}: SelectProps) {
  const combinedClassName = [
    baseStyles,
    disabled ? disabledStyles : '',
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      disabled={disabled}
      className={combinedClassName}
      {...props}
    >
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
