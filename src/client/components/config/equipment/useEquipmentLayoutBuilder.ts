/**
 * Equipment Layout Builder Hook
 *
 * Owns every decision the display builder makes: the grid's size, which slot stands on which cell,
 * which glyph each placed slot shows, and the one-time seeding that gives a ruleset the sheet's
 * own figure the first time the page is opened. The panel renders; this decides.
 *
 * **The seeding is an effect, and that is the deliberate part.** Opening this page writes to the
 * ruleset when — and only when — it has no `equipmentLayout` at all. That is the alternative to a
 * hardcoded fallback in play mode: rather than the sheet guessing at slot names forever, the guess
 * happens once, in front of the User, on a page where they can immediately change it.
 * `seedEquipmentLayout` is a no-op on a ruleset that already has a layout, so a re-render, a
 * remount or a second tab cannot re-seed over the User's arrangement.
 *
 * **Validates: Requirements 7.5, 12.1, 12.2, 21.1-21.5**
 */

import { useEffect, useState } from 'react';
import { FALLBACK_GLYPH, seedPlacementFor } from '#shared/engine/equipmentLayout';
import type { EquipmentSlot, GlyphName } from '#shared/types';
import { MAX_EQUIPMENT_GRID_COLUMNS, MAX_EQUIPMENT_GRID_ROWS } from '#shared/types';
import { useConfigStore } from '../../../stores/configStore';

/**
 * One cell of the builder's grid, and whatever stands on it
 *
 * Not exported: the panel takes `cells` off the hook's return and the type comes with it, so an
 * export here would be a name nothing imports.
 */
interface LayoutCell {
  /** 1-based */
  column: number;
  /** 1-based */
  row: number;
  slot: EquipmentSlot | null;
}

/**
 * The glyph a slot should show once it is on the board
 *
 * Whatever it already had wins, so moving a slot never loses the drawing the User chose. Only a
 * slot being placed for the first time falls through to the seed table's suggestion — which is why
 * placing `head` draws a helm without the picker ever being opened — and then to the plain shape.
 */
function glyphFor(slot: EquipmentSlot): GlyphName {
  return slot.placement?.glyph ?? seedPlacementFor(slot.type)?.glyph ?? FALLBACK_GLYPH;
}

export function useEquipmentLayoutBuilder() {
  const config = useConfigStore((state) => state.config);
  const setEquipmentLayout = useConfigStore((state) => state.setEquipmentLayout);
  const placeEquipmentSlot = useConfigStore((state) => state.placeEquipmentSlot);
  const seedEquipmentLayout = useConfigStore((state) => state.seedEquipmentLayout);

  /** Which slot's glyph picker is open, by slot type — purely local to this screen */
  const [glyphTarget, setGlyphTarget] = useState<string | null>(null);

  const layout = config?.equipmentLayout ?? null;
  const hasConfig = config !== null;

  useEffect(() => {
    if (!hasConfig || layout) return;

    seedEquipmentLayout();
  }, [hasConfig, layout, seedEquipmentLayout]);

  const equipmentSlots = config?.equipmentSlots ?? [];

  const columns = layout?.columns ?? 0;
  const rows = layout?.rows ?? 0;

  /**
   * The grid, row by row
   *
   * Built by walking the cells and looking the slot up rather than by walking the slots, so an
   * empty cell is a real entry the User can drop something into — the grid is the subject here,
   * not the slot list.
   */
  const cells: LayoutCell[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      cells.push({
        column,
        row,
        slot:
          equipmentSlots.find(
            (slot) => slot.placement?.column === column && slot.placement?.row === row
          ) ?? null,
      });
    }
  }

  const placedTypes = new Set(cells.filter((cell) => cell.slot).map((cell) => cell.slot?.type));
  const unplaced = equipmentSlots.filter((slot) => !placedTypes.has(slot.type));

  const glyphSlot = equipmentSlots.find((slot) => slot.type === glyphTarget) ?? null;

  const handleResize = (next: { columns?: number; rows?: number }) => {
    if (!layout) return;

    setEquipmentLayout({
      columns: next.columns ?? layout.columns,
      rows: next.rows ?? layout.rows,
    });
  };

  /** Put a slot on a cell, or empty the cell when `type` is blank */
  const handleAssign = (column: number, row: number, type: string) => {
    if (type === '') {
      const occupant = cells.find((cell) => cell.column === column && cell.row === row)?.slot;
      if (occupant) placeEquipmentSlot(occupant.type, null);
      return;
    }

    const moving = equipmentSlots.find((slot) => slot.type === type);
    if (!moving) return;

    placeEquipmentSlot(type, { column, row, glyph: glyphFor(moving) });
  };

  const handleChooseGlyph = (glyph: GlyphName) => {
    const slot = glyphSlot;
    if (!slot?.placement) return;

    placeEquipmentSlot(slot.type, { ...slot.placement, glyph });
    setGlyphTarget(null);
  };

  return {
    config,
    layout,
    columns,
    rows,
    maxColumns: MAX_EQUIPMENT_GRID_COLUMNS,
    maxRows: MAX_EQUIPMENT_GRID_ROWS,
    cells,
    unplaced,
    /** The slot whose glyph is being chosen, or `null` when the picker is closed */
    glyphSlot,
    openGlyphPicker: setGlyphTarget,
    closeGlyphPicker: () => setGlyphTarget(null),
    handleResize,
    handleAssign,
    handleChooseGlyph,
  };
}
