/**
 * Ornament Component Styles
 *
 * Intrinsic sizing only. Every ornament is decoration a caller *places* — pinned to a card corner,
 * hung on a beam — so the root carries no margin and no positioning; `className` brings both.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = ['block', 'pointer-events-none', 'select-none'].join(' ');

/**
 * The natural size of each ornament, and the aspect it is drawn at
 *
 * Sizes are deliberately small and fixed: an ornament that scales with its container stops
 * reading as carved hardware and starts reading as a picture.
 */
export const variantStyles = {
  corner: 'h-12 w-12',
  fleuron: 'h-4 w-12',
  rivet: 'h-2.5 w-2.5',
  seal: 'h-12 w-12',
};

export type OrnamentVariant = keyof typeof variantStyles;
