// Base Component Library
// This directory contains all base UI components with medieval theme styling
// 
// ARCHITECTURE PRINCIPLES:
// 
// Base components encapsulate INTRINSIC styles only:
// - Colors (background, text, border colors)
// - Typography (font family, size, weight, line height)
// - Padding and internal spacing
// - Borders and border radius
// - Visual states (hover, focus, active, disabled)
// - Transitions and animations
// - Box shadows and visual effects
// - Intrinsic sizing (min-width, min-height)
//
// Base components DO NOT include POSITIONING styles:
// - Margin (external spacing)
// - Flexbox/Grid properties (display, flex, grid, align-items, justify-content)
// - Positioning (absolute, relative, fixed, sticky)
// - Width/height constraints imposed by parent layout
// - Z-index layering
//
// USAGE:
// Feature components use these base components and handle all layout/positioning
// via the className prop:
//
// Example:
//   <Button variant="primary" className="ml-4 flex-1">Save</Button>
//                                      ^^^^^^^^^^^^^^^^
//                                      Positioning added by feature component
//
// MEDIEVAL THEME:
// All base components use the medieval color palette, fonts, and styling
// defined in src/styles.css to maintain consistent theming throughout the app.

// Export base components here as they are created
export { Button } from './Button/Button';
export type { ButtonProps } from './Button/Button';
// export { Input } from './Input';
// export { Card } from './Card';

