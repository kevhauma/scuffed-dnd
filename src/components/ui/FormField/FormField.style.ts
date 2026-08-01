/**
 * Form Field Component Styles
 *
 * FormField composes Label + Input + message, so these classes are the component laying out its
 * own sub-elements — not positioning itself in a parent. Its outermost element stays unstyled so
 * the caller owns width and placement.
 */

// The input fills the field's own width and sits below the label
export const inputStyles = 'w-full mt-2';

// Error and helper text sit tight under the input
export const messageStyles = 'mt-1';
