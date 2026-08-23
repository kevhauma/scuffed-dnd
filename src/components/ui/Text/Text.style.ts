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
 *
 * **The typeface is held the same way**, and for the same reason. `baseStyles` used to be
 * `font-body`, so every heading carried `font-body font-heading` and the winner was whichever
 * Tailwind happened to emit last — which is to say, the order the families are declared in
 * `styles.css`. It gave the right answer by luck. Each variant now names its own family and the
 * base names none, so nothing can be un-overridable again.
 */

/** Size, family, weight and box styling — everything about a variant except its colour */
export const variantStyles = {
  // Body text variants
  body: 'font-body text-base',
  'body-secondary': 'font-body text-base',
  'body-small': 'font-body text-sm',
  'body-small-secondary': 'font-body text-sm',

  // Heading variants. `tracking-wide` because Cinzel is a display face cut from Roman capitals —
  // it wants air between the letters, and now that `font-heading` actually resolves it is finally
  // Cinzel these are set in rather than the body serif inherited from `body`.
  h1: 'text-4xl font-heading font-semibold tracking-wide',
  h2: 'text-3xl font-heading font-semibold tracking-wide',
  h3: 'text-2xl font-heading font-semibold tracking-wide',
  h4: 'text-xl font-heading font-semibold tracking-wide',
  h5: 'text-lg font-heading font-semibold tracking-wide',
  h6: 'text-base font-heading font-semibold tracking-wide',

  // Semantic variants
  label: 'font-body text-sm font-medium',
  caption: 'font-body text-xs',
  // Ruled into the page like an input, at chip scale: a formula is a value the ruleset holds, not
  // a decoration, so it gets the same carved treatment every other value-bearing surface has
  code: 'text-sm font-mono bg-parchment-200 ring-1 ring-inset ring-ink-700/25 px-2 py-0.5 rounded',
  error: 'font-body text-sm',
  success: 'font-body text-sm',
  warning: 'font-body text-sm',
  muted: 'font-body text-sm',

  // Special variants
  highlight:
    'text-sm font-mono bg-parchment-300 ring-1 ring-inset ring-brass-dark/40 px-2 py-0.5 rounded inline-block',
  /**
   * Marginalia — a line in the hand that annotated the page rather than the hand that printed it.
   * For asides and welcomes only; never for a number, a label, or anything the User must read
   * quickly, because IM Fell is a low-contrast face at UI sizes.
   */
  quill: 'font-quill text-lg italic',
};

export type TextVariant = keyof typeof variantStyles;

/**
 * What every variant shares
 *
 * Nothing, deliberately — see the note at the top on why neither the colour nor the family can
 * live here. Kept as a constant so `libraryConventions.test.ts` still finds a root-element style
 * to check, and so a genuinely universal rule has somewhere to go.
 */
export const baseStyles = '';

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
  // `amber-dark` on parchment, `amber` on a dark ground: the bright dye is a light source, and at
  // 2.6:1 against paper it was never readable as text
  warning: { onParchment: 'text-amber-dark', onDark: 'text-amber' },
  muted: { onParchment: 'text-ink-600', onDark: 'text-parchment-300' },
  quill: { onParchment: 'text-ink-700', onDark: 'text-parchment-200' },

  // The chip's own brass keyline carries the accent, so the words in it can just be legible
  highlight: { onParchment: 'text-ink-800', onDark: 'text-ink-800' },
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
