/**
 * Import/Export — equipment slots and the grid they sit on
 *
 * Split out of `importExport.test.ts` by TICKET-SPL-01; see that file's header for the split's rule.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; TICKET-INV-03, TICKET-INV-04**
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Configuration } from '../types/config';
import {
  importConfiguration,
  serializeConfiguration,
  validateConfigurationShape,
} from './importExport';
import { makeValidConfiguration } from './importExport.fixtures';

describe('Import/Export — equipment', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('the equipment grid and its placements (TICKET-INV-03)', () => {
    const shapeOf = (overrides: Record<string, unknown>) =>
      validateConfigurationShape({ ...validConfig, ...overrides });

    const placed = (placement: unknown) => ({
      equipmentSlots: [{ type: 'head', name: 'Head', description: '', placement }],
    });

    it('accepts a ruleset with no layout and no placements — the pre-builder shape', () => {
      expect(shapeOf({})).toEqual({ isValid: true, errors: [] });
    });

    it('accepts a grid with slots placed on it', () => {
      const result = shapeOf({
        equipmentLayout: { columns: 3, rows: 4 },
        ...placed({ column: 2, row: 1, glyph: 'helm' }),
      });

      expect(result).toEqual({ isValid: true, errors: [] });
    });

    it('rejects a grid larger than the app can draw', () => {
      const result = shapeOf({ equipmentLayout: { columns: 7, rows: 4 } });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('equipmentLayout.columns must be a whole number from 1 to 6');
    });

    it('rejects a grid that is not a { columns, rows } object', () => {
      const result = shapeOf({ equipmentLayout: [3, 4] });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Field 'equipmentLayout' must be a { columns, rows } object when present"
      );
    });

    it('rejects a cell that is not a whole number from 1 up', () => {
      // A fractional or zero column places nothing and reports nothing — the tile simply stops
      // being drawn, which is the silence this check exists to break
      const result = shapeOf(placed({ column: 1.5, row: 0, glyph: 'helm' }));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'equipmentSlots[0].placement.column must be a whole number from 1 up'
      );
      expect(result.errors).toContain(
        'equipmentSlots[0].placement.row must be a whole number from 1 up'
      );
    });

    it('rejects a glyph the app has no drawing for', () => {
      const result = shapeOf(placed({ column: 1, row: 1, glyph: 'dragon' }));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'equipmentSlots[0].placement.glyph must be a glyph the app can draw'
      );
    });

    it('rejects a placement that is not an object', () => {
      const result = shapeOf(placed('column 2'));

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'equipmentSlots[0].placement must be a { column, row, glyph } object when present'
      );
    });
  });

  describe('a slot set of any size round-trips (TICKET-INV-04)', () => {
    /** A ruleset with this many slots, each placed on its own cell of a board that holds them */
    function withSlots(count: number): Configuration {
      const equipmentSlots = Array.from({ length: count }, (_, index) => ({
        type: `slot_${index}`,
        name: `Slot ${index}`,
        description: '',
        placement: {
          column: (index % 4) + 1,
          row: Math.floor(index / 4) + 1,
          glyph: 'slot' as const,
        },
      }));

      return { ...validConfig, equipmentLayout: { columns: 4, rows: 3 }, equipmentSlots };
    }

    it('survives export then import at one slot and at twelve', () => {
      // The count is the User's (v4.0 overview, *Rulings — ticket review*), so the file format
      // cannot have a favourite number either
      const one = withSlots(1);
      const twelve = withSlots(12);
      const oneExported = serializeConfiguration(one);
      const twelveExported = serializeConfiguration(twelve);

      expect(importConfiguration(oneExported)).toEqual(one);
      expect(importConfiguration(twelveExported)).toEqual(twelve);
    });

    it('accepts either size as a valid shape', () => {
      const one = withSlots(1);
      const twelve = withSlots(12);

      expect(validateConfigurationShape(one)).toEqual({ isValid: true, errors: [] });
      expect(validateConfigurationShape(twelve)).toEqual({ isValid: true, errors: [] });
    });
  });
});
