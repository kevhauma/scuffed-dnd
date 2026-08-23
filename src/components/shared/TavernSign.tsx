/**
 * Tavern Sign
 *
 * The app's mark: a board hung from a wrought bracket with a pewter tankard on it. It stands in
 * for the "you are in a tavern" the rest of the interface only implies, which is why it sits in
 * the one place every screen shares.
 *
 * Purely a picture — the app's *name* is real text beside it, so the wordmark stays selectable,
 * searchable and readable to a screen reader. The sign carries a `<title>` rather than being
 * hidden, because unlike an `Ornament` it is the brand rather than decoration.
 *
 * **Validates: Requirements 22.1, 22.2, 22.6**
 */

import { useId } from 'react';

export interface TavernSignProps {
  /** Placement and size, from the caller */
  className?: string;
}

export function TavernSign({ className = '' }: TavernSignProps) {
  // The sign hangs in two places at once — the shell's beam and the landing page's welcome — so a
  // literal id would put two `tavern-sign-title`s in the document and leave `aria-labelledby`
  // pointing at whichever the browser found first. The colons `useId` returns are legal in an id
  // but not in a CSS selector, and stripping them keeps the value usable from either.
  const titleId = `${useId().replace(/:/g, '')}-title`;

  return (
    <svg
      className={`block ${className}`}
      viewBox="0 0 56 48"
      role="img"
      aria-labelledby={titleId}
      focusable="false"
    >
      <title id={titleId}>A tavern sign hanging from a bracket</title>

      {/* The bracket, and the rings the board swings on */}
      <rect x="2" y="1" width="52" height="3" rx="1.5" fill="var(--color-brass-dark)" />
      <rect x="2" y="1" width="52" height="1" rx="0.5" fill="var(--color-brass-light)" />
      {[16, 40].map((x) => (
        <g key={x} fill="none" stroke="var(--color-brass)" strokeWidth="1.4">
          <path d={`M${x} 4v3`} strokeLinecap="round" />
          <circle cx={x} cy="9" r="2.2" />
        </g>
      ))}

      {/* The board */}
      <rect
        x="8"
        y="11"
        width="40"
        height="33"
        rx="3"
        fill="var(--color-oak-700)"
        stroke="var(--color-brass)"
        strokeWidth="1.4"
      />
      <path
        d="M11 17h34M11 39h34"
        stroke="var(--color-oak-900)"
        strokeOpacity="0.45"
        strokeWidth="1"
      />

      {/* A tankard, foam and all */}
      <path
        d="M34 25c3.6 0 5 1.8 5 4.2s-1.4 4.2-5 4.2"
        fill="none"
        stroke="var(--color-stone-300)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 21h14l-1.3 15.4a2.2 2.2 0 0 1-2.2 2h-7a2.2 2.2 0 0 1-2.2-2Z"
        fill="var(--color-stone-300)"
      />
      <path
        d="M23 23.5h3l-1 12h-2Z"
        fill="var(--color-parchment-50)"
        fillOpacity="0.45"
        // The highlight down the side of the pot: one band of candlelight, the same light the
        // whole room is lit by
      />
      <path
        d="M19.4 21c-.4-2.8 2.4-4.2 4.6-3 1.4-2.2 5.2-2.2 6.4 0 2.6-1 5 .8 4.4 3Z"
        fill="var(--color-parchment-50)"
      />
    </svg>
  );
}
