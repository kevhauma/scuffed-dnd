/**
 * Equipment Layout Panel Tests
 *
 * The store is real with storage mocked, so every placement here really goes through
 * `configStore` — which is what makes the assertions about eviction, pruning and seeding
 * meaningful rather than a restatement of the component's own state.
 *
 * **Validates: Requirements 7.5, 12.1, 12.2, 21.1-21.5, 22.1-22.6**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  clearAllData: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import type { EquipmentSlot } from '#shared/types/config';
import { useConfigStore } from '../../../stores/configStore';
import { EquipmentLayoutPanel } from './EquipmentLayoutPanel';

const HEAD: EquipmentSlot = { type: 'head', name: 'Head', description: '' };
const FEET: EquipmentSlot = { type: 'feet', name: 'Feet', description: '' };
const HORNS: EquipmentSlot = { type: 'horns', name: 'Horns', description: '' };

function withSlots(...slots: EquipmentSlot[]) {
  useConfigStore.setState({ config: null, isLoaded: false });
  useConfigStore.getState().initializeConfig('Test Config');
  for (const slot of slots) {
    useConfigStore.getState().addEquipmentSlot(slot);
  }
}

/** The cell control at a 1-based position */
function cell(column: number, row: number): HTMLSelectElement {
  return screen.getByLabelText(`Slot at column ${column}, row ${row}`) as HTMLSelectElement;
}

describe('EquipmentLayoutPanel', () => {
  beforeEach(() => {
    withSlots(HEAD, FEET, HORNS);
  });

  it('should seed the sheet’s figure the first time it is opened', () => {
    // The alternative this replaced was a hardcoded recognition table in play mode. Seeding here
    // is what makes the arrangement the User's from the very first visit.
    expect(useConfigStore.getState().config?.equipmentLayout).toBeUndefined();

    render(<EquipmentLayoutPanel />);

    expect(useConfigStore.getState().config?.equipmentLayout).toEqual({ columns: 3, rows: 4 });
    expect(cell(2, 1).value).toBe('head');
    expect(cell(2, 4).value).toBe('feet');
  });

  it('should draw one control per cell of the configured grid', () => {
    render(<EquipmentLayoutPanel />);

    expect(screen.getAllByLabelText(/^Slot at column/)).toHaveLength(12);
  });

  it('should list a slot it could not place as not on the figure', () => {
    render(<EquipmentLayoutPanel />);

    const unplaced = screen.getByRole('heading', { name: 'Not on the figure' }).parentElement;
    expect(unplaced?.textContent).toContain('Horns');
    expect(unplaced?.textContent).not.toContain('Head');
  });

  it('should place a slot on the cell the User chose', () => {
    render(<EquipmentLayoutPanel />);

    fireEvent.change(cell(1, 1), { target: { value: 'horns' } });

    const slots = useConfigStore.getState().config?.equipmentSlots ?? [];
    expect(slots.find((slot) => slot.type === 'horns')?.placement).toEqual({
      column: 1,
      row: 1,
      glyph: 'slot',
    });
  });

  it('should turn out whoever was standing on the cell', () => {
    render(<EquipmentLayoutPanel />);

    fireEvent.change(cell(2, 1), { target: { value: 'horns' } });

    const slots = useConfigStore.getState().config?.equipmentSlots ?? [];
    expect(slots.find((slot) => slot.type === 'head')?.placement).toBeUndefined();
    expect(cell(2, 1).value).toBe('horns');
  });

  it('should move a placed slot to another cell in one gesture', () => {
    // Offering only the *unplaced* slots would make this two: empty the old cell, fill the new one
    render(<EquipmentLayoutPanel />);

    fireEvent.change(cell(1, 1), { target: { value: 'head' } });

    expect(cell(1, 1).value).toBe('head');
    expect(cell(2, 1).value).toBe('');
    expect(
      useConfigStore.getState().config?.equipmentSlots.find((slot) => slot.type === 'head')
        ?.placement
    ).toEqual({ column: 1, row: 1, glyph: 'helm' });
  });

  it('should say where a slot standing elsewhere would come from', () => {
    render(<EquipmentLayoutPanel />);

    const offered = [...cell(1, 1).options].map((option) => option.text);
    expect(offered).toContain('Head (from column 2, row 1)');
    // The cell's own occupant is named plainly — it is not coming from anywhere
    expect([...cell(2, 1).options].map((option) => option.text)).toContain('Head');
  });

  it('should empty a cell without deleting the slot', () => {
    render(<EquipmentLayoutPanel />);

    fireEvent.change(cell(2, 1), { target: { value: '' } });

    expect(cell(2, 1).value).toBe('');
    expect(useConfigStore.getState().config?.equipmentSlots).toHaveLength(3);
    expect(
      screen.getByRole('heading', { name: 'Not on the figure' }).parentElement?.textContent
    ).toContain('Head');
  });

  it('should resize the grid and take the slots outside it off the figure', () => {
    render(<EquipmentLayoutPanel />);

    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '2' } });

    expect(useConfigStore.getState().config?.equipmentLayout).toEqual({ columns: 3, rows: 2 });
    expect(screen.getAllByLabelText(/^Slot at column/)).toHaveLength(6);
    expect(
      useConfigStore.getState().config?.equipmentSlots.find((slot) => slot.type === 'feet')
        ?.placement
    ).toBeUndefined();
  });

  it('should change a placed slot’s glyph through the picker', () => {
    render(<EquipmentLayoutPanel />);

    fireEvent.click(screen.getByRole('button', { name: /^Glyph for Head/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Crown' }));

    expect(
      useConfigStore.getState().config?.equipmentSlots.find((slot) => slot.type === 'head')
        ?.placement
    ).toEqual({ column: 2, row: 1, glyph: 'crown' });
    // The dialog closes on choosing, so the picker's own buttons are gone
    expect(screen.queryByRole('button', { name: 'Crown' })).toBeNull();
  });

  it('should offer a glyph for every slot kind, not just the ones the seed knows', () => {
    render(<EquipmentLayoutPanel />);
    fireEvent.change(cell(1, 1), { target: { value: 'horns' } });

    fireEvent.click(screen.getByRole('button', { name: /^Glyph for Horns/ }));

    // Grouped, and reaching well past the seven the sheet's figure needs
    expect(screen.getByRole('heading', { name: 'Shapes' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Bow' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Lantern' })).toBeDefined();
  });

  it('should say so rather than draw a board when the ruleset defines no slots', () => {
    useConfigStore.setState({ config: null, isLoaded: false });
    useConfigStore.getState().initializeConfig('Empty');

    render(<EquipmentLayoutPanel />);

    expect(screen.getByText(/No equipment slots to arrange yet/)).toBeDefined();
    expect(screen.queryByLabelText(/^Slot at column/)).toBeNull();
  });

  it('should refuse to draw anything without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<EquipmentLayoutPanel />);

    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });
});

/**
 * The builder has no opinion about how many slots a ruleset has (TICKET-INV-04)
 *
 * One, the sheet's six, twelve — the board is the User's and the count is theirs with it. The
 * v4 workbook's six spellings are here because they are the case that made the question urgent, not
 * because the app knows a body has six of anything.
 */
describe('EquipmentLayoutPanel at any slot count', () => {
  /** The v4 workbook's six body slots, `Backpack` C4:D9 */
  const SHEET_SIX = [
    'head_gear',
    'upperbody_gear',
    'lowerbody_gear',
    'foot_gear',
    'right_hand',
    'left_hand',
  ];

  /** Six the seed table has never heard of, so twelve is genuinely twelve */
  const INVENTED_SIX = ['horns', 'tail', 'bond', 'sigil', 'familiar', 'cloak_pin'];

  function withTypes(types: string[]) {
    const slots = types.map((type) => ({ type, name: type, description: '' }));
    withSlots(...slots);
  }

  /** The slot names the panel currently lists as not on the figure */
  function unplacedNames(): string {
    const heading = screen.getByRole('heading', { name: 'Not on the figure' });
    return heading.parentElement?.textContent ?? '';
  }

  it('should place a single slot and call the board complete', () => {
    withTypes(['head_gear']);

    render(<EquipmentLayoutPanel />);

    expect(cell(2, 1).value).toBe('head_gear');
    expect(unplacedNames()).toContain('Every slot is placed.');
  });

  it('should open a v4 ruleset with all six on the figure', () => {
    withTypes(SHEET_SIX);

    render(<EquipmentLayoutPanel />);

    expect(cell(2, 1).value).toBe('head_gear');
    expect(cell(2, 2).value).toBe('upperbody_gear');
    expect(cell(2, 3).value).toBe('lowerbody_gear');
    expect(cell(2, 4).value).toBe('foot_gear');
    expect(cell(1, 2).value).toBe('right_hand');
    expect(cell(3, 2).value).toBe('left_hand');
    expect(unplacedNames()).toContain('Every slot is placed.');
  });

  it('should let the User put all twelve of a twelve-slot ruleset on the board', () => {
    withTypes([...SHEET_SIX, ...INVENTED_SIX]);

    render(<EquipmentLayoutPanel />);

    // The seed places the six it knows and leaves the rest for the User, who has six free cells on
    // the default 3×4 board and puts one slot on each
    for (const type of INVENTED_SIX) {
      expect(unplacedNames(), `${type} should start unplaced`).toContain(type);
    }

    const freeCells = [
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
      [1, 4],
      [3, 4],
    ];
    freeCells.forEach(([column, row], index) => {
      fireEvent.change(cell(column, row), { target: { value: INVENTED_SIX[index] } });
    });

    expect(unplacedNames()).toContain('Every slot is placed.');

    const slots = useConfigStore.getState().config?.equipmentSlots ?? [];
    expect(slots).toHaveLength(12);
    expect(slots.every((slot) => slot.placement)).toBe(true);
  });
});
