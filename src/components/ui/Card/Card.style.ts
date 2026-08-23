/**
 * Card Component Styles
 *
 * A card is a sheet of parchment someone put down on the tavern table, and it is meant to look
 * like one rather than like a rounded rectangle. Four things do that work, and three of them live
 * in `styles.css` because Tailwind has no utility for them — see the note on `.card-hand` and
 * `.card-parchment` there:
 *
 * - **hand-cut corners**, a different radius on every corner
 * - **a dog-eared bottom-right**, folded back to show the underside of the sheet
 * - **coffee rings**, scattered over an eleven-card cycle so some sheets are marked and some are not
 * - **light from above**, a soft warm wash down the top of the page
 * - **grain**, so the fill is paper rather than a colour
 *
 * The page under these cards is aged parchment and the room behind it is timber, so the sheets no
 * longer need to be near-white to separate — they are the lightest thing on screen by design.
 *
 * Nothing here uses `transform`, `filter` or `clip-path`, and that is a constraint rather than an
 * oversight: all three would make the card a containing block for (or a clip on) `position: fixed`
 * descendants, and several panels render a `Dialog` *inside* a `Card`. A tilted card would have
 * pinned every modal in the app to its own corner. The one exception is `interactive`, which a
 * card containing a modal cannot be.
 */

// Base styles - intrinsic only (no margin/positioning)
export const baseStyles = ['card-hand', 'p-6', 'transition-all duration-200'].join(' ');

/**
 * What a card wears when it is itself the control — a section link on the dashboard
 *
 * The only place a `Card` takes a transform. It is safe precisely because of what the prop means:
 * a card the User clicks *through* cannot also be a card that contains a dialog. The tilt is a
 * third of a degree, which reads as the sheet being nudged rather than as an animation.
 */
export const interactiveStyles = [
  'cursor-pointer',
  'hover:-translate-y-0.5 hover:-rotate-[0.35deg]',
  'hover:shadow-parchment-lg',
].join(' ');

/**
 * Variant styles
 *
 * **No borders on the parchment variants.** A sheet of paper has no outline — it has an edge you
 * can see because of the shadow under it. Drawing a keyline as well gave every card a hard
 * boundary that fought the shadow and flattened the whole stack back into diagrams of cards. The
 * three light variants are now separated from the page by depth alone, which is why they differ
 * only in how far off the table they sit.
 *
 * `plaque` keeps its brass keyline: it is not paper, and a metal edge on a wooden board is the
 * point of it.
 */
export const variantStyles = {
  /** A sheet set down on the table */
  default: ['card-parchment', 'bg-parchment-50', 'shadow-parchment'].join(' '),
  /** A sheet with the rest of the pile still under it */
  elevated: ['card-parchment', 'bg-parchment-50', 'shadow-stack'].join(' '),
  /** Lifted clear of the page, for a card that is itself a section */
  bordered: ['card-parchment', 'bg-parchment-50', 'shadow-parchment-lg'].join(' '),
  /**
   * A carved oak plaque with a brass keyline — the one dark card.
   *
   * Timber, so it takes `surface-fibre` and no dog-ear: wood does not fold. It keeps the hand-cut
   * corners, which read as a board someone sawed rather than as a missing radius.
   *
   * Everything inside it needs `Text`'s `inverse`, which is exactly the case that prop was added
   * for (CR-07). Use it for a heading or a call to action, never for a body of text.
   */
  plaque: [
    'surface-fibre',
    'bg-oak-800',
    'border-2 border-brass-dark',
    'ring-1 ring-inset ring-brass/30',
    'shadow-parchment-lg',
  ].join(' '),
};
