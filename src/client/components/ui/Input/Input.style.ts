/**
 * Input Component Styles
 *
 * A field is a line ruled *into* the page rather than a box drawn on top of it: a slightly darker
 * parchment, an ink hairline, and `shadow-carved` so the surface reads as pressed. Focus brings the
 * candle to it — `shadow-quill` keeps the inset and adds the glow, which a `ring` utility could not
 * do without throwing the inset away.
 *
 * The focus ring carries no offset. Tailwind's ring offset paints white, which was invisible
 * against the near-white surfaces this theme used to have and is a bright halo against the warm
 * ones it has now.
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
].join(' ');

// Error state styles
export const errorStyles = ['border-crimson', 'focus:border-crimson'].join(' ');

// Disabled state styles
export const disabledStyles = [
  'opacity-60',
  'cursor-not-allowed',
  'bg-parchment-200',
  'shadow-none',
].join(' ');
