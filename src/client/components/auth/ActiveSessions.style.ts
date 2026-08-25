/**
 * Class strings for the active-sessions list (TICKET-AUTH-04)
 *
 * The same row shape `LinkedIdentities.style.ts` uses, and deliberately not shared with it: the two
 * lists sit on one page and look alike *because they are both lists on parchment*, not because one
 * is a variant of the other. Sharing them would mean a variant prop before anything needs one —
 * the reasoning `authSurfaces.style.ts` records for the link strings.
 */

/** One session's row: when and what on the left, the way to end it on the right */
export const sessionRowStyles = [
  'flex flex-wrap items-center justify-between gap-3',
  'rounded border border-brass-dark/40 bg-parchment-100 px-3 py-2',
].join(' ');

/** *This browser* — stated in `royal` rather than `forest`, so it does not read as an approval */
export const currentMarkerStyles = 'font-heading text-sm tracking-wide text-royal';
