/**
 * Equipment Layout Tests
 *
 * The seed is the source spreadsheet's figure (`Charactersheet!M3:O15`), so those assertions are
 * about the *shape* it lays out — a head above a chest, hands either side of it, feet at the
 * bottom — rather than about coordinates. Everything else here is about the rules that keep a
 * User-arranged board drawable: one slot per cell, nothing outside the grid, and absence meaning
 * "not placed" rather than "broken".
 *
 * Grew out of `components/play/inventory/slotLayout.test.ts`, which tested the same figure back
 * when it was hardcoded in play mode.
 *
 * **Two generations of spelling are pinned here** (TICKET-INV-04): the v4 workbook renamed its body
 * slots, so each new spelling is asserted to stand on the box its old spelling already had, and the
 * old ones are asserted to still resolve. Neither the table nor these tests say anything about how
 * *many* slots a ruleset has — that is the builder's, and the component tests prove it.
 */

import { describe, expect, it } from 'vitest';
import type { EquipmentSlot, EquipmentSlotPlacement } from '../types/config';
import {
  cellKey,
  clampEquipmentLayout,
  DEFAULT_EQUIPMENT_LAYOUT,
  isWithinLayout,
  prunePlacements,
  seedPlacementFor,
  seedPlacements,
  splitByPlacement,
} from './equipmentLayout';

function slot(type: string, placement?: EquipmentSlot['placement']): EquipmentSlot {
  return { type, name: type, description: '', ...(placement ? { placement } : {}) };
}

/** The seeded placement for a type the table is expected to know */
function seeded(type: string): EquipmentSlotPlacement {
  const placement = seedPlacementFor(type);
  if (!placement) throw new Error(`${type} is not in the seed table`);
  return placement;
}

/** The v4 workbook's six body slots, `Backpack` C4:D9 — the spellings TICKET-INV-04 added */
const SHEET_SIX = [
  'head_gear',
  'upperbody_gear',
  'lowerbody_gear',
  'foot_gear',
  'right_hand',
  'left_hand',
];

/** The old workbook's seven, which keep their figure — nothing was removed to make room */
const OLD_SHEET_SLOTS = ['head', 'chest', 'main_hand', 'off_hand', 'legs', 'accessory', 'feet'];

/** Every hand-written spelling the table has ever recognised, beside the box it stands on */
const OLD_SHEET_ALIASES: Record<string, string> = {
  helmet: 'head',
  helm: 'head',
  weapon: 'main_hand',
  body: 'chest',
  torso: 'chest',
  shield: 'off_hand',
  ring: 'accessory',
  boots: 'feet',
};

/** Each v4 spelling beside the old one whose box it joins */
const SHEET_SIX_BOXES: Record<string, string> = {
  head_gear: 'head',
  upperbody_gear: 'chest',
  lowerbody_gear: 'legs',
  foot_gear: 'feet',
  right_hand: 'main_hand',
  left_hand: 'off_hand',
};

describe('seedPlacementFor', () => {
  it('should lay the sheet’s seven boxes out as a body', () => {
    const head = seeded('head');
    const chest = seeded('chest');
    const main = seeded('main_hand');
    const off = seeded('off_hand');
    const legs = seeded('legs');
    const feet = seeded('feet');

    // A spine down the middle, in order
    expect([head.column, chest.column, legs.column, feet.column]).toEqual([2, 2, 2, 2]);
    expect(head.row).toBeLessThan(chest.row);
    expect(chest.row).toBeLessThan(legs.row);
    expect(legs.row).toBeLessThan(feet.row);

    // A hand either side of the chest, on its row
    expect(main.row).toBe(chest.row);
    expect(off.row).toBe(chest.row);
    expect(main.column).toBeLessThan(chest.column);
    expect(off.column).toBeGreaterThan(chest.column);
  });

  it('should fit inside the grid it seeds alongside, in both generations of spelling', () => {
    // Both halves in one loop on purpose (TICKET-INV-04): the v4 spellings join the figure the old
    // ones already draw, so a box that moved out of the grid would take both with it.
    const spellings = [...OLD_SHEET_SLOTS, ...SHEET_SIX];

    for (const type of spellings) {
      expect(
        isWithinLayout(seeded(type), DEFAULT_EQUIPMENT_LAYOUT),
        `${type} seeds outside the default grid`
      ).toBe(true);
    }
  });

  it('should give each box the glyph of the thing that goes in it', () => {
    expect(seedPlacementFor('head')?.glyph).toBe('helm');
    expect(seedPlacementFor('main_hand')?.glyph).toBe('main-hand');
    expect(seedPlacementFor('off_hand')?.glyph).toBe('off-hand');
    expect(seedPlacementFor('feet')?.glyph).toBe('feet');
  });

  it('should recognise a slot however it is spelled', () => {
    // The sheet says `main_hand`; a ruleset written by hand says `Main Hand` or `main-hand`. All
    // three name the same box.
    const canonical = seedPlacementFor('main_hand');

    expect(seedPlacementFor('Main Hand')).toEqual(canonical);
    expect(seedPlacementFor('main-hand')).toEqual(canonical);
    expect(seedPlacementFor('  MAIN_HAND  ')).toEqual(canonical);
  });

  it('should have no opinion about a slot it has never heard of', () => {
    expect(seedPlacementFor('horns')).toBeNull();
  });

  it('should put the v4 sheet’s six spellings on the boxes the old ones already stand on', () => {
    // TICKET-INV-04. `right_hand` beside `main_hand` rather than replacing it — the new workbook
    // renamed its boxes, and a ruleset written against the old one is still a ruleset.
    for (const [recent, original] of Object.entries(SHEET_SIX_BOXES)) {
      const box = seeded(original);
      const stands = seedPlacementFor(recent);

      expect(stands, `${recent} does not stand where ${original} does`).toEqual(box);
    }
  });

  it('should keep every spelling it recognised before, alias for alias', () => {
    // The other half of the same promise: nothing was removed to make room for the six above.
    for (const type of OLD_SHEET_SLOTS) {
      const kept = seedPlacementFor(type);

      expect(kept, `${type} fell out of the seed table`).not.toBeNull();
    }

    for (const [alias, original] of Object.entries(OLD_SHEET_ALIASES)) {
      const box = seeded(original);
      const resolved = seedPlacementFor(alias);

      expect(resolved, `${alias} no longer resolves like ${original}`).toEqual(box);
    }

    // `amulet` shares the accessory cell and differs only in its drawing, so it is checked apart
    const amulet = seeded('amulet');
    const accessory = seeded('accessory');

    expect(amulet.column).toBe(accessory.column);
    expect(amulet.row).toBe(accessory.row);
    expect(amulet.glyph).toBe('amulet');
  });

  it('should hand out a copy, so one ruleset cannot edit another’s seed', () => {
    // Several spellings share one box now that they are named constants rather than repeated
    // literals; handing the object itself out would make the table writable from a distance.
    const first = seeded('head');
    const second = seeded('head_gear');

    expect(first).not.toBe(second);
  });
});

describe('seedPlacements', () => {
  it('should place the slots it recognises and leave the rest for the User', () => {
    const seeded = seedPlacements([slot('head'), slot('horns'), slot('feet')]);

    expect(seeded[0].placement).toEqual({ column: 2, row: 1, glyph: 'helm' });
    expect(seeded[1].placement).toBeUndefined();
    expect(seeded[2].placement).toEqual({ column: 2, row: 4, glyph: 'feet' });
  });

  it('should open a v4 ruleset on a whole figure with nothing left over', () => {
    // TICKET-INV-04's first criterion: a ruleset whose slots are exactly the sheet's six opens the
    // builder placed, not as six boxes in the loose row.
    const slots = SHEET_SIX.map((type) => slot(type));
    const placedSix = seedPlacements(slots);

    const placements = placedSix.map((entry) => entry.placement);
    expect(placements.every(Boolean), 'a slot seeded unplaced').toBe(true);

    const cells = placedSix.map((entry) => cellKey(entry.placement as EquipmentSlotPlacement));
    expect(new Set(cells).size).toBe(6);

    const glyphs = placedSix.map((entry) => entry.placement?.glyph);
    expect(glyphs).toEqual(['helm', 'chest', 'legs', 'feet', 'main-hand', 'off-hand']);
  });

  it('should give a cell to the first claimant only', () => {
    // `ring` and `amulet` both seed to column 3 row 3. Two boxes drawn on top of each other is
    // not a figure, so the second stays unplaced and the User puts it somewhere.
    const seeded = seedPlacements([slot('ring'), slot('amulet')]);

    expect(seeded[0].placement?.column).toBe(3);
    expect(seeded[1].placement).toBeUndefined();
  });

  it('should never overwrite a placement the slot already carries', () => {
    // An imported file can hold placements with no layout key. Redrawing the sheet's figure over
    // them would be the builder editing the User's work uninvited.
    const arranged = slot('head', { column: 1, row: 4, glyph: 'star' });

    expect(seedPlacements([arranged])[0].placement).toEqual({ column: 1, row: 4, glyph: 'star' });
  });

  it('should not seed onto a cell an existing placement already holds', () => {
    const seeded = seedPlacements([
      slot('chest', { column: 2, row: 1, glyph: 'chest' }),
      slot('head'),
    ]);

    expect(seeded[1].placement).toBeUndefined();
  });
});

describe('clampEquipmentLayout', () => {
  it('should hold a grid inside what the app can draw', () => {
    expect(clampEquipmentLayout({ columns: 99, rows: 99 })).toEqual({ columns: 6, rows: 6 });
    expect(clampEquipmentLayout({ columns: 0, rows: -4 })).toEqual({ columns: 1, rows: 1 });
    expect(clampEquipmentLayout({ columns: 3.4, rows: 4 })).toEqual({ columns: 3, rows: 4 });
  });

  it('should fall back to one rather than pass a non-number through', () => {
    expect(clampEquipmentLayout({ columns: Number.NaN, rows: Number.POSITIVE_INFINITY })).toEqual({
      columns: 1,
      rows: 1,
    });
  });
});

describe('prunePlacements', () => {
  it('should drop a placement the grid has no room for, keeping the slot', () => {
    const pruned = prunePlacements(
      [
        slot('head', { column: 2, row: 1, glyph: 'helm' }),
        slot('feet', { column: 2, row: 4, glyph: 'feet' }),
      ],
      { columns: 3, rows: 2 }
    );

    expect(pruned[0].placement).toEqual({ column: 2, row: 1, glyph: 'helm' });
    expect(pruned[1].placement).toBeUndefined();
    expect(pruned).toHaveLength(2);
  });

  it('should leave a slot object untouched when it still fits', () => {
    const fits = slot('head', { column: 1, row: 1, glyph: 'helm' });

    expect(prunePlacements([fits], { columns: 2, rows: 2 })[0]).toBe(fits);
  });
});

describe('splitByPlacement', () => {
  const layout = { columns: 3, rows: 4 };

  it('should draw the placed slots and list the rest', () => {
    const { placed, loose } = splitByPlacement(
      [slot('head', { column: 2, row: 1, glyph: 'helm' }), slot('horns')],
      layout
    );

    expect(placed.map((entry) => entry.type)).toEqual(['head']);
    expect(loose.map((entry) => entry.type)).toEqual(['horns']);
  });

  it('should treat a placement outside the grid as unplaced rather than throwing', () => {
    // Only reachable by import or a hand-edited export — the store prunes as it shrinks — but the
    // sheet has to render either way. `engine/validator.ts` is what reports it.
    const { placed, loose } = splitByPlacement(
      [slot('head', { column: 9, row: 1, glyph: 'helm' })],
      layout
    );

    expect(placed).toHaveLength(0);
    expect(loose).toHaveLength(1);
  });

  it('should give a contested cell to the first slot in configuration order', () => {
    const { placed, loose } = splitByPlacement(
      [
        slot('head', { column: 2, row: 1, glyph: 'helm' }),
        slot('hood', { column: 2, row: 1, glyph: 'cloak' }),
      ],
      layout
    );

    expect(placed.map((entry) => entry.type)).toEqual(['head']);
    expect(loose.map((entry) => entry.type)).toEqual(['hood']);
  });

  it('should place nothing when the ruleset has no layout', () => {
    const { placed, loose } = splitByPlacement(
      [slot('head', { column: 2, row: 1, glyph: 'helm' })],
      undefined
    );

    expect(placed).toHaveLength(0);
    expect(loose).toHaveLength(1);
  });
});

describe('isWithinLayout', () => {
  it('should reject a cell that is not a whole number pair on the board', () => {
    const layout = { columns: 3, rows: 4 };

    expect(isWithinLayout({ column: 1, row: 1 }, layout)).toBe(true);
    expect(isWithinLayout({ column: 3, row: 4 }, layout)).toBe(true);
    expect(isWithinLayout({ column: 0, row: 1 }, layout)).toBe(false);
    expect(isWithinLayout({ column: 4, row: 1 }, layout)).toBe(false);
    expect(isWithinLayout({ column: 1, row: 5 }, layout)).toBe(false);
    expect(isWithinLayout({ column: 1.5, row: 1 }, layout)).toBe(false);
  });
});

describe('cellKey', () => {
  it('should tell two cells apart without confusing their axes', () => {
    expect(cellKey({ column: 1, row: 2 })).not.toBe(cellKey({ column: 2, row: 1 }));
  });
});
