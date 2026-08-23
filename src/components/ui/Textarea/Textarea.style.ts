/**
 * Textarea Component Styles
 *
 * The same ruled-into-the-page treatment as `Input` — see the note there on why focus is a shadow
 * token rather than a ring.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'px-3 py-2',
  'font-body text-base',
  'text-ink-900',
  'bg-parchment-100',
  'border border-ink-700/40',
  'rounded',
  'shadow-carved',
  'transition-all duration-150',
  'placeholder:text-ink-600/70 placeholder:italic',
  'hover:border-ink-700/70',
  'focus:outline-none focus:border-amber focus:bg-parchment-50 focus:shadow-quill',
  'resize-y', // Allow vertical resize only
  'min-h-[80px]',
].join(' ');

// Error state styles — the same treatment `Input` gives an invalid field (CR-32)
export const errorStyles = ['border-crimson', 'focus:border-crimson'].join(' ');

// Disabled state styles
export const disabledStyles = [
  'opacity-60',
  'cursor-not-allowed',
  'bg-parchment-200',
  'shadow-none',
  'resize-none', // Disable resize when disabled
].join(' ');
