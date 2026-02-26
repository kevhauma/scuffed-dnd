// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'w-full',
  'px-3 py-2',
  'font-body text-base',
  'text-ink-900',
  'bg-white',
  'border-2 border-stone-200',
  'rounded-md',
  'transition-all duration-200',
  'placeholder:text-ink-600',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:border-amber',
  'hover:border-stone-300',
].join(' ');

// Error state styles
export const errorStyles = [
  'border-crimson',
  'focus:ring-crimson focus:border-crimson',
].join(' ');

// Disabled state styles
export const disabledStyles = [
  'opacity-50',
  'cursor-not-allowed',
  'bg-parchment-100',
].join(' ');
