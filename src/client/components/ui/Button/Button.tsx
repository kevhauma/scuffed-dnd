/**
 * Button Component
 *
 * Base button with medieval styling and primary/secondary/danger/plaque/ghost variants. `plaque`
 * is the one for a control sitting on timber rather than on parchment — the app shell's mode
 * switcher — and exists so that case needs no colour overrides from the caller.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { buttonStyles } from './Button.style';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'plaque' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...props
}: ButtonProps) {
  // `className` is the parent's — positioning and layout classes it is entitled to add
  const combinedClassName = buttonStyles(variant, size, className);

  return (
    <button type={type} disabled={disabled} className={combinedClassName} {...props}>
      {children}
    </button>
  );
}
