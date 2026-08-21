// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'px-3 py-2',
  'font-body text-base',
  'text-ink-900',
  'bg-parchment-50',
  'border-2 border-stone-200',
  'rounded-md',
  'transition-all duration-200',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2 focus:border-amber',
  'hover:border-stone-300',
  'cursor-pointer',
  'appearance-none',
  // The dropdown chevron. Its `%23…` fill is the `ink-700` token written out, because a data URI
  // cannot reach a CSS variable (CR-36) — the one colour in the component tree not spelled as a
  // token. `libraryConventions.test.ts` pins it to `--color-ink-700`, so retuning the palette
  // without this arrow fails the suite rather than leaving one off-theme triangle behind.
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234f4739' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")]",
  'bg-[length:12px] bg-[right_0.75rem_center] bg-no-repeat',
  'pr-10', // Extra padding for dropdown arrow
].join(' ');

// Error state styles — the same treatment `Input` gives an invalid field (CR-32)
export const errorStyles = ['border-crimson', 'focus:ring-crimson focus:border-crimson'].join(' ');

// Disabled state styles
export const disabledStyles = ['opacity-50', 'cursor-not-allowed', 'bg-parchment-100'].join(' ');
