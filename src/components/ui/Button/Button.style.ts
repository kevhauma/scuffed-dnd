// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'inline-flex items-center justify-center',
  'font-heading font-semibold',
  'border-2',
  'rounded-md',
  'transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

// Variant styles
export const variantStyles = {
  primary: [
    'bg-royal text-parchment-50',
    'border-royal',
    'hover:bg-royal-dark hover:border-royal-dark',
    'active:bg-royal-darker active:shadow-inner',
    'shadow-parchment',
  ].join(' '),
  secondary: [
    'bg-parchment-100 text-ink-900',
    'border-ink-700',
    'hover:bg-parchment-200 hover:border-ink-800',
    'active:bg-parchment-300 active:shadow-inner',
    'shadow-parchment',
  ].join(' '),
  danger: [
    'bg-crimson text-parchment-50',
    'border-crimson',
    'hover:bg-crimson-dark hover:border-crimson-dark',
    'active:bg-crimson-darker active:shadow-inner',
    'shadow-parchment',
  ].join(' '),
  ghost: [
    'bg-transparent text-ink-800',
    'border-transparent',
    'hover:bg-parchment-200 hover:border-stone-200',
    'active:bg-parchment-300',
  ].join(' '),
};

// Size styles (padding and font size only)
export const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * The whole class string a button-shaped control wears (CR-28)
 *
 * `Button` composes its own from this, and so does anything that must *look* like a button without
 * being one — a router `<Link>` used as a call to action, which cannot be a `<button>` without
 * losing its href. Reach for this instead of copying a variant's classes, so the copy cannot drift.
 */
export function buttonStyles(
  variant: keyof typeof variantStyles = 'primary',
  size: keyof typeof sizeStyles = 'md',
  className = ''
): string {
  return [baseStyles, variantStyles[variant], sizeStyles[size], className]
    .filter(Boolean)
    .join(' ');
}
