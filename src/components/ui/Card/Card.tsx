/**
 * Card Component
 *
 * Base parchment surface with default/elevated/bordered variants.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, variantStyles } from './Card.style';

export interface CardProps {
  variant?: 'default' | 'elevated' | 'bordered';
  children: React.ReactNode;
  className?: string;
}

export function Card({ variant = 'default', children, className = '' }: CardProps) {
  const combinedClassName = [
    baseStyles,
    variantStyles[variant],
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={combinedClassName}>{children}</div>;
}
