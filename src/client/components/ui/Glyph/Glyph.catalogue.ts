/**
 * Glyph Catalogue
 *
 * What each glyph is *called*, and the order a picker offers them in. Held apart from
 * [Glyph.tsx](./Glyph.tsx) because these are words rather than drawings: the component answers
 * "draw this", and this answers "what would a User call it, and where would they look for it".
 *
 * The names themselves come from `types/config.ts` — a glyph name is persisted on an
 * `EquipmentSlotPlacement` — and `Glyph.test.tsx` pins this file to that list in both directions,
 * so a new glyph cannot ship without a label or a home in a group, and a group cannot name a glyph
 * that does not exist.
 *
 * **Validates: Requirements 21.1, 21.2, 22.1, 22.2**
 */

import type { GlyphName } from '#shared/types/config';

/** What the picker calls each glyph — sentence case, the way a label reads */
export const GLYPH_LABELS: Record<GlyphName, string> = {
  helm: 'Helm',
  crown: 'Crown',
  mask: 'Mask',
  shoulders: 'Pauldrons',
  chest: 'Cuirass',
  cloak: 'Cloak',
  bracers: 'Bracers',
  gloves: 'Gauntlets',
  belt: 'Belt',
  legs: 'Greaves',
  feet: 'Boots',
  'main-hand': 'Sword',
  'off-hand': 'Shield',
  dagger: 'Dagger',
  axe: 'Axe',
  hammer: 'Hammer',
  staff: 'Staff',
  bow: 'Bow',
  wand: 'Wand',
  accessory: 'Ring',
  amulet: 'Amulet',
  gem: 'Gem',
  pack: 'Pack',
  pouch: 'Pouch',
  quiver: 'Quiver',
  tome: 'Tome',
  potion: 'Potion',
  lantern: 'Lantern',
  key: 'Key',
  banner: 'Banner',
  wings: 'Wings',
  tail: 'Tail',
  slot: 'Empty slot',
  circle: 'Circle',
  square: 'Square',
  diamond: 'Diamond',
  triangle: 'Triangle',
  star: 'Star',
  cross: 'Cross',
};

/** One heading in the picker, and the glyphs under it */
export interface GlyphGroup {
  label: string;
  names: readonly GlyphName[];
}

/**
 * The picker's sections, in the order it shows them
 *
 * Grouped by *where the thing goes* rather than by what it looks like, because that is the
 * question the User is answering: they have a slot called "Off hand" and want the drawing that
 * belongs in it. The generic shapes come last, for a slot the set has no picture of — a ruleset
 * with a "Bond" slot should not have to settle for a helm.
 */
export const GLYPH_GROUPS: readonly GlyphGroup[] = [
  {
    label: 'Worn',
    names: [
      'helm',
      'crown',
      'mask',
      'shoulders',
      'chest',
      'cloak',
      'bracers',
      'gloves',
      'belt',
      'legs',
      'feet',
    ],
  },
  {
    label: 'Held',
    names: ['main-hand', 'off-hand', 'dagger', 'axe', 'hammer', 'staff', 'bow', 'wand'],
  },
  { label: 'Trinkets', names: ['accessory', 'amulet', 'gem'] },
  { label: 'Carried', names: ['pack', 'pouch', 'quiver', 'tome', 'potion', 'lantern', 'key'] },
  { label: 'Creature', names: ['banner', 'wings', 'tail'] },
  {
    label: 'Shapes',
    names: ['slot', 'circle', 'square', 'diamond', 'triangle', 'star', 'cross'],
  },
];
