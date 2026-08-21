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

/**
 * Extends `HTMLAttributes` so `id`, `aria-*` and `data-*` reach the element (CR-32) — this was the
 * one primitive that dropped them, which put an `aria-label` or a test hook out of reach.
 */
export interface TextProps extends React.HTMLAttributes<HTMLElement> {
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
  ...rest
}: TextProps) {
  const Component = as;

  const combinedClassName = [baseStyles, variantStyles[variant], className]
    .filter(Boolean)
    .join(' ');

  const props: React.HTMLAttributes<HTMLElement> & { htmlFor?: string } = {
    ...rest,
    className: combinedClassName,
  };

  if (as === 'label' && htmlFor) {
    props.htmlFor = htmlFor;
  }

  return <Component {...props}>{children}</Component>;
}
