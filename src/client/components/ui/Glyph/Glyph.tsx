/**
 * Glyph Component
 *
 * Silhouette pictograms for the things a character wears, wields and carries — a helm, a cuirass, a
 * sword, a shield, greaves, boots, a ring, a pack — plus a handful of plain shapes (`slot`,
 * `circle`, `star` …) for a slot no drawing fits.
 *
 * They exist so an empty equipment slot can say what belongs in it without a word of text, which
 * is how every equipment screen in the genre does it and what makes a rack of slots readable at a
 * glance. Drawn in `currentColor` throughout, so one drawing serves a dim empty slot and a lit
 * filled one; the tile decides which by setting a text colour.
 *
 * **The set of names is not declared here.** `GLYPH_NAMES` lives in `types/config.ts` because a
 * name is persisted — an `EquipmentSlotPlacement` stores one — and it is re-exported here so the
 * callers that only care about drawing keep importing from the component. `drawings` is typed as
 * `Record<GlyphName, …>`, so adding a name without adding a drawing is a **type error** rather
 * than a blank tile, and `Glyph.catalogue.ts` is held to the same list by its own test.
 *
 * `aria-hidden`, always. The slot's name and its occupant are real text beside the glyph — a
 * screen reader announcing "image" over each of seven tiles would only be noise.
 *
 * **Validates: Requirements 12.1, 21.1, 21.2, 21.3, 22.1, 22.2, 22.6**
 */

import type { GlyphName } from '#shared/types/config';
import { baseStyles } from './Glyph.style';

export type { GlyphName };

export interface GlyphProps {
  name: GlyphName;
  /** Colour, and any size override, from the caller */
  className?: string;
}

/**
 * The drawings, on a 32×32 field
 *
 * Solid silhouettes rather than line art: they are shown small and often at low contrast, and a
 * stroked outline disappears at that size. Where a shape needs a hole — a helm's eye slits, a
 * ring's middle — it is one path with `fillRule="evenodd"` rather than a second shape painted in
 * the background colour, which would only be right on one background.
 */
const drawings: Record<GlyphName, React.ReactNode> = {
  helm: (
    <path
      fillRule="evenodd"
      d="M16 3a9 9 0 0 0-9 9v11a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V12a9 9 0 0 0-9-9Zm-4.5 9.5h4v4h-4v-4Zm9 0h-4v4h4v-4ZM14 19h4v6h-4v-6Z"
      fill="currentColor"
    />
  ),
  crown: (
    <path d="M4 23h24v5H4v-5Zm0-3L6.5 7l6 5.2L16 4l3.5 8.2L25.5 7 28 20H4Z" fill="currentColor" />
  ),
  mask: (
    <path
      fillRule="evenodd"
      d="M5 7h22v9c0 6.6-4.9 12-11 12S5 22.6 5 16V7Zm4.5 4.5v4.5h5v-4.5h-5Zm13 0h-5V16h5v-4.5Z"
      fill="currentColor"
    />
  ),
  shoulders: (
    <path
      d="M16 4c-6.6 0-11 4.2-11 10v4h22v-4c0-5.8-4.4-10-11-10ZM4.5 21h23l-1.8 7H6.3l-1.8-7Z"
      fill="currentColor"
    />
  ),
  chest: (
    <path
      d="M16 3 9 6 6 12l4 3v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V15l4-3-3-6-7-3Z"
      fill="currentColor"
    />
  ),
  cloak: (
    <path
      fillRule="evenodd"
      d="M16 2 23.5 6 29 29H3L8.5 6 16 2Zm0 5.4-3.6 1.9L16 27.4l3.6-18.1L16 7.4Z"
      fill="currentColor"
    />
  ),
  bracers: (
    <path d="M10 3h12l-1.6 8.5 1.8 4.2L20 29h-8l-2.2-13.3 1.8-4.2L10 3Z" fill="currentColor" />
  ),
  gloves: (
    <path
      d="M9 13a3 3 0 0 1 3-3h1V5.5a2.2 2.2 0 0 1 4.4 0V10H23a3 3 0 0 1 3 3v6.5A9.5 9.5 0 0 1 16.5 29H15a6 6 0 0 1-6-6v-10Zm-4 1h2v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Z"
      fill="currentColor"
    />
  ),
  belt: (
    <path
      fillRule="evenodd"
      d="M1 12h11v8H1v-8Zm19 0h11v8H20v-8Zm-7-2h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm1.5 4v4h3v-4h-3Z"
      fill="currentColor"
    />
  ),
  legs: <path d="M8 4h16l-1.5 24h-5L16 14l-1.5 14h-5L8 4Z" fill="currentColor" />,
  feet: (
    <path
      d="M11 3h6.5v12.5l6.9 3.6A3.6 3.6 0 0 1 26 22.3V26H11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
      fill="currentColor"
    />
  ),
  // A tapered blade rather than a 2px bar: at 36px on screen a one-unit-wide stroke on a 32-unit
  // field is a hairline, and the sword read as a plus sign
  'main-hand': (
    <path
      d="M16 2l3.2 4.4V18h-6.4V6.4L16 2ZM8 18h16v2.6H8V18Zm6.6 2.6h2.8V25h-2.8v-4.4ZM16 24.8a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z"
      fill="currentColor"
    />
  ),
  'off-hand': (
    <path
      d="M16 3 5 6.5v8.9C5 22 9.5 26.6 16 29.5 22.5 26.6 27 22 27 15.4V6.5L16 3Z"
      fill="currentColor"
    />
  ),
  // Half the sword's blade and a wider guard — the difference has to survive at 36px
  dagger: (
    <path
      d="M16 3l2.6 4.6V16h-5.2V7.6L16 3Zm-5 14h10v2.4H11V17Zm3.6 2.4h2.8V29h-2.8v-9.6Z"
      fill="currentColor"
    />
  ),
  axe: (
    <path
      d="M13.6 3h4.8v26h-4.8V3Zm4.8 2.2h2.8a9.6 9.6 0 0 1 8 8.4 9.6 9.6 0 0 1-8 8.4h-2.8V5.2Z"
      fill="currentColor"
    />
  ),
  hammer: <path d="M5 5h22v9.5H5V5Zm8.6 9.5h4.8V29h-4.8V14.5Z" fill="currentColor" />,
  staff: (
    <path
      d="M16 2a4.6 4.6 0 1 1 0 9.2A4.6 4.6 0 0 1 16 2Zm-2.3 10.6h4.6V30h-4.6V12.6Z"
      fill="currentColor"
    />
  ),
  bow: (
    <path
      d="M22.6 2 25 4.1c-3.7 3.9-5.6 7.8-5.6 11.9s1.9 8 5.6 11.9L22.6 30c-4.4-4.6-6.6-9.3-6.6-14s2.2-9.4 6.6-14Zm.4 3.4h2.4v21.2H23V5.4ZM7 14.8h13v2.4H7v-2.4Z"
      fill="currentColor"
    />
  ),
  wand: (
    <path
      d="M4 25.2 18.8 10.4l2.8 2.8L6.8 28 4 25.2Zm20-21 1.6 4.2 4.2 1.6-4.2 1.6L24 15.8l-1.6-4.2-4.2-1.6 4.2-1.6L24 4.2Z"
      fill="currentColor"
    />
  ),
  accessory: (
    <path
      fillRule="evenodd"
      d="M16 8.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm0 4.6a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8ZM16 1.5l4.2 5.3h-8.4L16 1.5Z"
      fill="currentColor"
    />
  ),
  amulet: (
    <path
      d="M16 2A12 12 0 0 0 4 14h3.6A8.4 8.4 0 0 1 16 5.6 8.4 8.4 0 0 1 24.4 14H28A12 12 0 0 0 16 2Zm0 12a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z"
      fill="currentColor"
    />
  ),
  gem: (
    <path
      fillRule="evenodd"
      d="M10 4h12l6.5 8.4L16 29 3.5 12.4 10 4Zm1.8 3-3.2 4h14.8l-3.2-4h-8.4Z"
      fill="currentColor"
    />
  ),
  pack: (
    <path
      fillRule="evenodd"
      d="M10 5h12l3 7v11a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V12l3-7Zm4 8h4v4.5h-4V13Z"
      fill="currentColor"
    />
  ),
  pouch: (
    <path
      d="M11 2h10l-2.2 5.4h-5.6L11 2Zm2 6.6h6a9.6 9.6 0 0 1 7.4 9.2V23a6.6 6.6 0 0 1-6.6 6.6h-7.6A6.6 6.6 0 0 1 5.6 23v-5.2A9.6 9.6 0 0 1 13 8.6Z"
      fill="currentColor"
    />
  ),
  quiver: (
    <path
      d="M11.6 2h1.9v9.4h-1.9V2Zm3.5 0H17v9.4h-1.9V2Zm3.5 0h1.9v9.4h-1.9V2ZM9 12h14l-1.4 14.6A3.8 3.8 0 0 1 17.8 30h-3.6a3.8 3.8 0 0 1-3.8-3.4L9 12Z"
      fill="currentColor"
    />
  ),
  tome: (
    <path
      fillRule="evenodd"
      d="M8 3h15a2.6 2.6 0 0 1 2.6 2.6v20.8A2.6 2.6 0 0 1 23 29H8a2.6 2.6 0 0 1-2.6-2.6V5.6A2.6 2.6 0 0 1 8 3Zm2.2 3.2v19.6h1.9V6.2h-1.9Zm4.6 4.4v2.4h7v-2.4h-7Zm0 5.4v2.4h7v-2.4h-7Z"
      fill="currentColor"
    />
  ),
  potion: (
    <path
      d="M12.6 2h6.8v2.6h-1.5v6.8l5.7 10.2A6.4 6.4 0 0 1 18 30h-4a6.4 6.4 0 0 1-5.6-8.4l5.7-10.2V4.6h-1.5V2Z"
      fill="currentColor"
    />
  ),
  lantern: (
    <path
      fillRule="evenodd"
      d="M15 2h2v3.4h-2V2ZM10.6 6h10.8l2.2 4.4V25a4 4 0 0 1-4 4h-7.2a4 4 0 0 1-4-4V10.4L10.6 6Zm3.4 6.4v9.4h4v-9.4h-4Z"
      fill="currentColor"
    />
  ),
  key: (
    <path
      fillRule="evenodd"
      d="M10.6 4a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8Zm0 4.8a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2ZM18 9.6h12v4.2h-3v3.6h-3.4v-3.6H21v4.6h-3V9.6Z"
      fill="currentColor"
    />
  ),
  banner: <path d="M4 2h2.6v28H4V2Zm4.6 1H28v18.6L18.3 16 8.6 21.6V3Z" fill="currentColor" />,
  wings: (
    <path
      d="M15 10C11 4.6 6 2.2 1 3.2c0 9.2 5.2 15.4 12 17.6L15 10Zm2 0c4-5.4 9-7.8 14-6.8 0 9.2-5.2 15.4-12 17.6L17 10Z"
      fill="currentColor"
    />
  ),
  tail: (
    <path
      d="M18 2h6.6c0 8.4-3.2 13.8-8.6 17-3.6 2.2-5.4 4.8-5.4 8.4V30H4v-2.6c0-6.6 3.2-11.6 9.4-15.2C16.6 10.4 18 7.6 18 3.6V2Z"
      fill="currentColor"
    />
  ),
  slot: (
    <path
      fillRule="evenodd"
      d="M16 3 29 16 16 29 3 16 16 3Zm0 6.4L9.4 16l6.6 6.6 6.6-6.6L16 9.4Z"
      fill="currentColor"
    />
  ),
  circle: <path d="M16 4a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z" fill="currentColor" />,
  square: <path d="M5 5h22v22H5V5Z" fill="currentColor" />,
  diamond: <path d="M16 2.5 29.5 16 16 29.5 2.5 16 16 2.5Z" fill="currentColor" />,
  triangle: <path d="M16 3.5 29.5 28h-27L16 3.5Z" fill="currentColor" />,
  star: (
    <path
      d="m16 2 4 9.4 10.2.9-7.7 6.7 2.3 10L16 23.7 7.2 29l2.3-10L1.8 12.3l10.2-.9L16 2Z"
      fill="currentColor"
    />
  ),
  cross: <path d="M12.8 3h6.4v9.8H29v6.4h-9.8V29h-6.4v-9.8H3v-6.4h9.8V3Z" fill="currentColor" />,
};

export function Glyph({ name, className = '' }: GlyphProps) {
  const combinedClassName = [
    baseStyles,
    className, // Allow parent to add positioning/layout classes
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg className={combinedClassName} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {drawings[name]}
    </svg>
  );
}
