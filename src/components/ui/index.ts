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
// Base components DO NOT include POSITIONING styles on their outermost element:
// - Margin (external spacing)
// - Flexbox/Grid properties (display, flex, grid, align-items, justify-content)
// - Positioning (absolute, relative, fixed, sticky)
// - Width/height constraints imposed by parent layout — including `w-full`
// - Z-index layering
//
// A component laying out its OWN sub-elements is fine: FormField's label-to-input gap,
// FormulaEditor's error-message spacing, Dialog's `fixed inset-0` (a modal owns its placement).
//
// USAGE:
// Feature components use these base components and handle all layout/positioning
// via the className prop:
//
// Example:
//   <Button variant="primary" className="ml-4 flex-1">Save</Button>
//   <Input className="w-full" />   <- width is the caller's decision, not the input's
//                             ^^^^^^^^^^^^^^^^
//                             Positioning added by feature component
//
// IMPORTING:
// Feature code imports base components by deep path (`../../ui/Button/Button`), which is what
// every call site already does. This barrel is the folder's public listing rather than the
// import route — see the coding-conventions skill.
//
// MEDIEVAL THEME:
// All base components use the medieval color palette, fonts, and styling
// defined in src/styles.css to maintain consistent theming throughout the app.

export * from './Button/Button';
export * from './Card/Card';
export * from './Checkbox/Checkbox';
export * from './Dialog/Dialog';
export * from './ErrorChip/ErrorChip';
export * from './FormField/FormField';
export * from './FormulaEditor/FormulaEditor';
export * from './Input/Input';
export * from './Label/Label';
export * from './Select/Select';
export * from './Text/Text';
export * from './Textarea/Textarea';
export * from './ValidationReport/ValidationReport';
