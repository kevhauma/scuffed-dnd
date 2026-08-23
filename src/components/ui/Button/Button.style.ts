/**
 * Button Component Styles
 *
 * Buttons are the room's hardware: a primary action is a brass-edged oak plate, a secondary one is
 * a pressed parchment tab, a destructive one is sealing wax. They are lit from above like
 * everything else — a raised bevel at rest, and `shadow-carved` plus a one-pixel drop while held,
 * so a press reads as the control actually going *into* the surface.
 *
 * The three constants below are local: `buttonStyles` is what a caller composes (CR-28), so
 * exporting the pieces as well would be a second way to say the same thing.
 */

// Base styles - intrinsic only (no margin/positioning)
const baseStyles = [
  'inline-flex items-center justify-center',
  // No `whitespace-nowrap` here, tempting as it is for a label: `ArchetypeStep` renders a whole
  // card inside a Button, and `white-space` inherits — a nowrap on the root would run every
  // archetype's description off the side. A button squeezed by its container is the container's
  // problem to solve.
  'font-heading font-semibold tracking-wide',
  'border-2',
  'rounded-md',
  'transition-all duration-150',
  'active:translate-y-px',
  'focus:outline-none focus:ring-2 focus:ring-amber focus:ring-offset-2',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0',
].join(' ');

// Variant styles
const variantStyles = {
  /** Oak, edged in brass. Dark ground, so nested `Text` wants `inverse` (CR-07). */
  primary: [
    'bg-oak-700 text-parchment-50',
    'border-brass-dark',
    'shadow-brass',
    'hover:bg-oak-600 hover:border-brass',
    'active:bg-oak-800 active:shadow-carved',
  ].join(' '),
  /** A parchment tab, tooled at the edge */
  secondary: [
    'bg-parchment-200 text-ink-900',
    'border-ink-700/60',
    'shadow-parchment',
    'hover:bg-parchment-300 hover:border-ink-800',
    'active:bg-parchment-400 active:shadow-carved',
  ].join(' '),
  /** Sealing wax — the colour the app already reserves for a thing that cannot be undone */
  danger: [
    'bg-crimson text-parchment-50',
    'border-crimson-darker',
    'shadow-parchment',
    'hover:bg-crimson-dark hover:border-crimson-darker',
    'active:bg-crimson-darker active:shadow-carved',
  ].join(' '),
  /**
   * An unlit oak plaque — the variant for a control that sits on *timber* rather than on the page.
   *
   * It exists because the alternative was `ghost` with `text-*` and `border-*` overrides passed
   * through `className`, and a variant's own colour cannot be overridden from outside: two colour
   * utilities on one element are settled by stylesheet order, not by the order they are written
   * (CR-07). The mode switcher's resting button was drawing its border transparent because of it.
   */
  plaque: [
    'bg-oak-800 text-parchment-300',
    'border-brass-dark/70',
    'hover:bg-oak-700 hover:text-parchment-50 hover:border-brass',
    'active:bg-oak-900 active:shadow-carved',
  ].join(' '),
  /** No hardware at all until you reach for it */
  ghost: [
    'bg-transparent text-ink-800',
    'border-transparent',
    'hover:bg-parchment-200 hover:border-ink-700/25',
    'active:bg-parchment-300',
  ].join(' '),
};

// Size styles (padding and font size only)
const sizeStyles = {
  /**
   * Icon-sized, for a control that sits *inside* other furniture — the × on an equipment tile.
   *
   * It is a size rather than a `className` override at the call site because padding passed from
   * outside loses to the size's own padding on stylesheet order, the same way a colour does
   * (CR-07). A caller needing a smaller button needs a smaller size, not a fight.
   */
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * The whole class string a button-shaped control wears (CR-28)
 *
 * `Button` composes its own from this, and so does anything that must *look* like a button without
 * being one — a router `<Link>` used as a call to action, which cannot be a `<button>` without
 * losing its href. Reach for this instead of copying a variant's classes, so the copy cannot drift.
 */
export function buttonStyles(
  variant: keyof typeof variantStyles = 'primary',
  size: keyof typeof sizeStyles = 'md',
  className = ''
): string {
  return [baseStyles, variantStyles[variant], sizeStyles[size], className]
    .filter(Boolean)
    .join(' ');
}
