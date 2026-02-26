// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'bg-parchment-50',
  'rounded-lg',
  'p-6',
  'transition-all duration-200',
].join(' ');

// Variant styles
export const variantStyles = {
  default: [
    'border border-stone-200',
    'shadow-parchment',
  ].join(' '),
  elevated: [
    'border border-stone-200',
    'shadow-parchment-lg',
  ].join(' '),
  bordered: [
    'border-2 border-ink-700',
    'shadow-none',
  ].join(' '),
};
