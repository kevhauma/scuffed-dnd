/**
 * Label Component Styles
 *
 * Set in the heading face, small and letterspaced — a caption engraved above a field rather than a
 * second run of body text beside it. The size drop is deliberate: the label is now visibly a
 * different *kind* of text from the value below it, which is what stopped forms reading as a wall
 * of undifferentiated serif.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = [
  'inline-block',
  'font-heading font-semibold text-sm uppercase tracking-wider',
  'text-ink-800',
  'select-none',
].join(' ');

// Required indicator styles
export const requiredStyles = ['ml-1', 'text-crimson', 'font-bold'].join(' ');
