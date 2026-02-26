import React from 'react';
import { baseStyles, variantStyles } from './Card.style';

export interface CardProps {
  variant?: 'default' | 'elevated' | 'bordered';
  children: React.ReactNode;
  className?: string;
}

export function Card({
  variant = 'default',
  children,
  className = '',
}: CardProps) {
  const combinedClassName = [
    baseStyles,
    variantStyles[variant],
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={combinedClassName}>
      {children}
    </div>
  );
}
