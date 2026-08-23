/**
 * Glyph Component Styles
 *
 * Intrinsic sizing only, and one size for the whole set — a glyph is a pictogram in a fixed frame,
 * so a caller wanting it bigger passes `h-10 w-10` rather than the component growing a `size` prop
 * nothing but one call site would use.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = ['block', 'h-8 w-8', 'shrink-0'].join(' ');
