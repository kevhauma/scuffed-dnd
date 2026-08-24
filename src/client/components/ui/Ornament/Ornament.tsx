/**
 * Ornament Component
 *
 * The app's decorative SVG vocabulary: a vine corner, a divider fleuron, a brass rivet and a wax
 * seal. One component rather than four so the whole set is listed in one place and a caller picks
 * from it by name, the way `Text` picks a variant.
 *
 * Every ornament is drawn in `currentColor`, so it takes its colour from whatever it is pinned to
 * (`text-brass`, `text-ink-700`) rather than carrying one of its own. The one exception is the
 * rivet's highlight, which is brass by definition — a rivet in another colour is not a rivet.
 *
 * All four are `aria-hidden`: they carry no information, and a screen reader announcing "image"
 * four times per card is worse than silence.
 *
 * **Validates: Requirements 21.1, 21.2, 21.3, 22.1, 22.2, 22.6**
 */

import { baseStyles, type OrnamentVariant, variantStyles } from './Ornament.style';

export interface OrnamentProps {
  /** Which ornament to draw */
  variant: OrnamentVariant;
  /** Placement and colour, from the caller */
  className?: string;
}

/** The drawing for each variant, keyed the same way the styles are */
const drawings: Record<OrnamentVariant, { viewBox: string; paint: React.ReactNode }> = {
  /*
   * A vine growing out of the corner: one sweeping stem, two leaves and a bud, with a thin
   * keyline running behind it. The leaves sit on points actually taken from the stem's curve, so
   * they grow out of it rather than float beside it.
   */
  corner: {
    viewBox: '0 0 48 48',
    paint: (
      <>
        <path
          d="M1.5 46V13A11.5 11.5 0 0 1 13 1.5H46"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="1"
        />
        <path
          d="M2 46C2 26 10 10 30 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M6 24c-4-1-6 3-5 7 4 1 6-3 5-7Z" fill="currentColor" />
        <path d="M15 12c4-5 10-4 12 1-4 4-10 3-12-1Z" fill="currentColor" />
        <circle cx="30" cy="4" r="2.4" fill="currentColor" />
      </>
    ),
  },

  /* The centrepiece of a section rule: a lozenge with a leaf reaching out either side */
  fleuron: {
    viewBox: '0 0 48 16',
    paint: (
      <>
        <path d="M20 8C15 3 9 4 4 8c5 4 11 5 16 0Z" fill="currentColor" />
        <path d="M28 8c5-5 11-4 16 0-5 4-11 5-16 0Z" fill="currentColor" />
        <path d="M24 2.5 28.5 8 24 13.5 19.5 8Z" fill="currentColor" />
        <circle cx="24" cy="8" r="1.4" fill="currentColor" fillOpacity="0.35" />
      </>
    ),
  },

  /* A hammered stud, lit from the upper left like everything else in the room */
  rivet: {
    viewBox: '0 0 16 16',
    paint: (
      <>
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <circle cx="6.4" cy="6.2" r="3.4" fill="var(--color-brass-light)" fillOpacity="0.6" />
        <circle
          cx="8"
          cy="8"
          r="6.6"
          fill="none"
          stroke="var(--color-oak-900)"
          strokeOpacity="0.5"
          strokeWidth="0.8"
        />
      </>
    ),
  },

  /*
   * Wax, pressed with a signet. The blob is deliberately irregular — a perfectly round seal reads
   * as a button, which is the one thing it must not be mistaken for.
   */
  seal: {
    viewBox: '0 0 48 48',
    paint: (
      <>
        <path
          d="M24 2c7 0 9 4 14 6s8 5 8 12-5 9-7 14-4 12-11 12-10-4-15-7-8-4-8-12 3-9 5-14 7-11 14-11Z"
          fill="currentColor"
        />
        <path
          d="M24 12c6 0 11 5 11 11s-5 11-11 11-11-5-11-11 5-11 11-11Z"
          fill="none"
          stroke="var(--color-oak-900)"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        <path
          d="m24 15 2.6 5.6 6 .8-4.4 4.2 1.1 6.1-5.3-2.9-5.3 2.9 1.1-6.1-4.4-4.2 6-.8Z"
          fill="var(--color-oak-900)"
          fillOpacity="0.3"
        />
      </>
    ),
  },
};

export function Ornament({ variant, className = '' }: OrnamentProps) {
  const { viewBox, paint } = drawings[variant];

  const combinedClassName = [
    baseStyles,
    variantStyles[variant],
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg className={combinedClassName} viewBox={viewBox} aria-hidden="true" focusable="false">
      {paint}
    </svg>
  );
}
