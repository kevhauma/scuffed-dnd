/**
 * Tavern Backdrop
 *
 * The room the app is in: a timber wall, a candle burning off to one side, and the dark corners a
 * low-ceilinged room has. It sits behind everything, fixed to the viewport, and never scrolls —
 * the parchment moves, the room does not.
 *
 * All of it is one SVG rather than a stack of gradient divs, for three reasons: the plank
 * structure is *drawn* (seams, grain, knots) and CSS has no vocabulary for that; the grain filter
 * runs once on a 240px tile and is then repeated by the pattern, instead of once over the whole
 * viewport; and every colour can be a theme token read straight out of the stylesheet with
 * `var(--color-…)`, so the room is retuned by editing the palette like everything else.
 *
 * `preserveAspectRatio` is left off deliberately — there is no `viewBox`, so the SVG's user space
 * *is* CSS pixels and the planks keep their thickness at every window size instead of stretching.
 *
 * **Validates: Requirements 22.1, 22.2, 22.5, 22.6**
 */

import { useId } from 'react';

export function TavernBackdrop() {
  // Scoped ids rather than literals. Only one backdrop is mounted today, but an SVG `id` is
  // document-global: a second instance would silently repoint every `url(#…)` in the first at its
  // own defs. The colons `useId` returns are legal in an id and not in a CSS selector, so they go.
  const uid = useId().replace(/:/g, '');
  const grainId = `${uid}-grain`;
  const planksId = `${uid}-planks`;
  const candleId = `${uid}-candle`;
  const hearthId = `${uid}-hearth`;
  const vignetteId = `${uid}-vignette`;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-oak-900" aria-hidden="true">
      <svg className="h-full w-full" width="100%" height="100%" focusable="false">
        <title>Candlelit timber wall</title>
        <defs>
          {/* Wood grain: noise stretched hard along the plank's length, so the grain runs with the
              timber rather than sitting on top of it as a haze */}
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.5"
              numOctaves="5"
              seed="7"
              stitchTiles="stitch"
              result="noise"
            />
            {/* Red channel straight into alpha, with a hard ramp: the mid-greys of raw turbulence
                read as fog, and only the extremes look like grain in wood */}
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.8 0 0 0 -0.55"
            />
          </filter>

          {/* One plank, tiled. The seam is a dark line at the board's bottom edge with a lit one
              just under it — the way a chamfer catches light coming from above. */}
          <pattern
            id={planksId}
            width="240"
            height="112"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(0.6)"
          >
            <rect width="240" height="112" fill="var(--color-oak-700)" />
            <rect width="240" height="112" filter={`url(#${grainId})`} opacity="0.7" />
            <rect y="109" width="240" height="3" fill="var(--color-oak-900)" />
            <rect y="0" width="240" height="1.5" fill="var(--color-oak-500)" opacity="0.55" />
            <rect x="118" width="3" height="112" fill="var(--color-oak-900)" opacity="0.7" />
            <rect x="121" width="1" height="112" fill="var(--color-oak-500)" opacity="0.3" />
            {/* A knot, so the tiling is not perfectly anonymous */}
            <ellipse cx="62" cy="58" rx="10" ry="5.5" fill="var(--color-oak-900)" opacity="0.5" />
            <ellipse cx="62" cy="58" rx="4" ry="2" fill="var(--color-oak-500)" opacity="0.45" />
          </pattern>

          {/* The candle, up and to the left of the page */}
          <radialGradient id={candleId} cx="22%" cy="8%" r="70%">
            <stop offset="0%" stopColor="var(--color-candle)" stopOpacity="0.42" />
            <stop offset="35%" stopColor="var(--color-ember)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-oak-900)" stopOpacity="0" />
          </radialGradient>

          {/* A second, lower light — the hearth, far side of the room */}
          <radialGradient id={hearthId} cx="88%" cy="88%" r="55%">
            <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-oak-900)" stopOpacity="0" />
          </radialGradient>

          {/* The corners a candle never reaches */}
          <radialGradient id={vignetteId} cx="50%" cy="38%" r="82%">
            <stop offset="40%" stopColor="var(--color-oak-900)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-oak-900)" stopOpacity="0.8" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill={`url(#${planksId})`} />
        <rect width="100%" height="100%" fill={`url(#${hearthId})`} />
        <rect
          width="100%"
          height="100%"
          fill={`url(#${candleId})`}
          className="animate-candle origin-center"
        />
        <rect width="100%" height="100%" fill={`url(#${vignetteId})`} />
      </svg>
    </div>
  );
}
