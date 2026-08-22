/**
 * Text Component Styles
 *
 * Medieval-themed text styling with semantic variants.
 *
 * Colour is held **apart from** the rest of a variant (CR-07). Two `text-*` utilities on one
 * element are decided by stylesheet order rather than by the order they are written, so a colour
 * class cannot be overridden from outside — a `Text` nested in the pressed `primary` Button kept
 * its near-black ink over the button's dark royal ground and became illegible. The only reliable
 * fix is to not emit the losing class at all, which is what `inverse` does.
 */

/** Size, family, weight and box styling — everything about a variant except its colour */
export const variantStyles = {
  // Body text variants
  body: 'text-base',
  'body-secondary': 'text-base',
  'body-small': 'text-sm',
  'body-small-secondary': 'text-sm',

  // Heading variants
  h1: 'text-4xl font-heading font-semibold',
  h2: 'text-3xl font-heading font-semibold',
  h3: 'text-2xl font-heading font-semibold',
  h4: 'text-xl font-heading font-semibold',
  h5: 'text-lg font-heading font-semibold',
  h6: 'text-base font-heading font-semibold',

  // Semantic variants
  label: 'text-sm font-medium',
  caption: 'text-xs',
  code: 'text-sm font-mono bg-parchment-200 px-2 py-1 rounded',
  error: 'text-sm',
  success: 'text-sm',
  warning: 'text-sm',
  muted: 'text-sm',

  // Special variants
  highlight: 'text-sm font-mono bg-parchment-200 px-2 py-1 rounded inline-block',
};

export type TextVariant = keyof typeof variantStyles;

export const baseStyles = 'font-body';

/**
 * What each variant reads in, on the page's parchment and on a dark ground
 *
 * `code` and `highlight` paint their own light ground, so they read the same either way — an
 * "inverse" code chip would be light text on the light chip it carries with it.
 *
 * The three status colours keep their meaning inverted: crimson, forest and amber are all too dark
 * to sit on royal, so they lift to the parchment steps and stay distinguishable by weight and
 * position rather than by hue. A status message inside a pressed control is not a shape the app
 * has yet; this exists so that it degrades to legible rather than to invisible.
 */
const variantColors: Record<TextVariant, { onParchment: string; onDark: string }> = {
  body: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  'body-secondary': { onParchment: 'text-ink-700', onDark: 'text-parchment-300' },
  'body-small': { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  'body-small-secondary': { onParchment: 'text-ink-700', onDark: 'text-parchment-300' },

  h1: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  h2: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  h3: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  h4: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  h5: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  h6: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },

  label: { onParchment: 'text-ink-900', onDark: 'text-parchment-50' },
  caption: { onParchment: 'text-ink-700', onDark: 'text-parchment-300' },
  code: { onParchment: 'text-ink-900', onDark: 'text-ink-900' },
  error: { onParchment: 'text-crimson', onDark: 'text-parchment-50' },
  success: { onParchment: 'text-forest', onDark: 'text-parchment-50' },
  warning: { onParchment: 'text-amber', onDark: 'text-parchment-300' },
  muted: { onParchment: 'text-ink-600', onDark: 'text-parchment-300' },

  highlight: { onParchment: 'text-amber', onDark: 'text-amber' },
};

/**
 * The colour class for one variant
 *
 * @param variant - The text variant
 * @param inverse - True when the text sits on a dark ground rather than on parchment
 * @returns Exactly one `text-*` colour utility
 */
export function colorFor(variant: TextVariant, inverse: boolean): string {
  return inverse ? variantColors[variant].onDark : variantColors[variant].onParchment;
}
