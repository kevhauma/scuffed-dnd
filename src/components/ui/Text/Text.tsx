/**
 * Text Component
 *
 * Base text component with semantic variants for consistent typography.
 * Supports different HTML elements while maintaining consistent styling.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 21.6, 21.7, 22.1-22.6**
 */

import type React from 'react';
import { baseStyles, type TextVariant, variantStyles } from './Text.style';

export interface TextProps {
  variant?: TextVariant;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';
  children: React.ReactNode;
  className?: string;
  htmlFor?: string; // For label elements
}

export function Text({
  variant = 'body',
  as = 'span',
  children,
  className = '',
  htmlFor,
}: TextProps) {
  const Component = as;

  const combinedClassName = [baseStyles, variantStyles[variant], className]
    .filter(Boolean)
    .join(' ');

  const props: React.HTMLAttributes<HTMLElement> & { htmlFor?: string } = {
    className: combinedClassName,
  };

  if (as === 'label' && htmlFor) {
    props.htmlFor = htmlFor;
  }

  return <Component {...props}>{children}</Component>;
}
