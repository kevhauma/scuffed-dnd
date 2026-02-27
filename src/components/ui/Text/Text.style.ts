/**
 * Text Component Styles
 * 
 * Medieval-themed text styling with semantic variants.
 */

export const baseStyles = 'font-body';

export const variantStyles = {
  // Body text variants
  body: 'text-base text-ink-900',
  'body-secondary': 'text-base text-ink-700',
  'body-small': 'text-sm text-ink-900',
  'body-small-secondary': 'text-sm text-ink-700',
  
  // Heading variants
  h1: 'text-4xl font-heading text-ink-900 font-semibold',
  h2: 'text-3xl font-heading text-ink-900 font-semibold',
  h3: 'text-2xl font-heading text-ink-900 font-semibold',
  h4: 'text-xl font-heading text-ink-900 font-semibold',
  h5: 'text-lg font-heading text-ink-900 font-semibold',
  h6: 'text-base font-heading text-ink-900 font-semibold',
  
  // Semantic variants
  label: 'text-sm text-ink-900 font-medium',
  caption: 'text-xs text-ink-700',
  code: 'text-sm font-mono text-ink-900 bg-parchment-200 px-2 py-1 rounded',
  error: 'text-sm text-crimson',
  success: 'text-sm text-forest',
  warning: 'text-sm text-amber',
  muted: 'text-sm text-ink-600',
  
  // Special variants
  highlight: 'text-sm font-mono text-amber bg-parchment-200 px-2 py-1 rounded inline-block',
};

export type TextVariant = keyof typeof variantStyles;
