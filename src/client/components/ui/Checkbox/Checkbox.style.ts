/**
 * Checkbox Component Styles
 *
 * A brass-edged box cut into the parchment, which fills with ink when ticked. `appearance-none` is
 * what makes that possible: a native checkbox ignores `background`, `border` and `border-radius` in
 * Chrome, so the old `checked:bg-royal` never painted anything and every box on screen was the
 * browser's own.
 *
 * The tick itself is `.checkbox-tick` in `styles.css`, not a utility here: Tailwind's scanner
 * declines to emit a `checked:bg-[url(…)]` candidate, so the box painted ink with nothing in it.
 * The rule there carries the `%23…` copy of `parchment-50` that a data URI needs, and
 * `libraryConventions.test.ts` pins it to that token.
 */

// Checkbox styles - intrinsic only (no margin/positioning)
export const checkboxStyles = [
  'w-5 h-5',
  'appearance-none',
  'bg-parchment-100',
  'border-2 border-brass-dark',
  'rounded-sm',
  'shadow-carved',
  'transition-all duration-150',
  'cursor-pointer',
  'hover:border-brass hover:bg-parchment-50',
  'focus:outline-none focus:ring-2 focus:ring-amber',
  'checkbox-tick',
  'checked:bg-ink-900 checked:border-ink-800',
  'checked:hover:bg-ink-800 checked:hover:border-ink-700',
].join(' ');

// Label text styles
export const labelStyles = [
  'font-body text-base',
  'text-ink-900',
  'cursor-pointer',
  'select-none',
].join(' ');

// Disabled state styles
export const disabledStyles = ['opacity-50', 'cursor-not-allowed', 'shadow-none'].join(' ');
