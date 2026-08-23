/**
 * Equipment Slots Configuration Panel Tests
 *
 * The panel moved off `/config/items` in TICKET-INV-02 and gained one real responsibility with
 * TICKET-INV-03: a slot now carries a placement, and `updateEquipmentSlot` merges through
 * `mergeClearingAbsent`, so a save that forgets to carry it deletes it. That is the case worth
 * pinning here — the rest of the CRUD is covered by the store's own tests.
 *
 * **Validates: Requirements 7.5, 21.1-21.5**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  clearAllData: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { EquipmentSlotsConfigPanel } from './EquipmentSlotsConfigPanel';

describe('EquipmentSlotsConfigPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: null, isLoaded: false });
    useConfigStore.getState().initializeConfig('Test Config');
  });

  it('should show its empty state before any slot exists', () => {
    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByRole('heading', { name: 'Equipment Slots' })).toBeDefined();
    expect(screen.getByText(/No equipment slots configured yet/)).toBeDefined();
  });

  it('should add a slot through the store', async () => {
    render(<EquipmentSlotsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Equipment Slot' }));

    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: 'head' } });
    fireEvent.change(screen.getByLabelText(/^Display Name/), { target: { value: 'Head' } });
    fireEvent.submit(screen.getByLabelText(/^Type/).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(useConfigStore.getState().config?.equipmentSlots).toEqual([
        { type: 'head', name: 'Head', description: '' },
      ]);
    });
  });

  it('should say where a placed slot sits, and that an unplaced one does not', () => {
    useConfigStore.getState().addEquipmentSlot({
      type: 'head',
      name: 'Head',
      description: '',
      placement: { column: 2, row: 1, glyph: 'helm' },
    });
    useConfigStore.getState().addEquipmentSlot({ type: 'horns', name: 'Horns', description: '' });

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText(/On the figure at column 2, row 1 · Helm/)).toBeDefined();
    expect(screen.getByText('Not placed on the figure')).toBeDefined();
  });

  it('should keep a slot on the figure when it is renamed', async () => {
    // `updateEquipmentSlot` merges with `mergeClearingAbsent`, so a save built from the form alone
    // would send `placement: undefined` and knock the slot off the board
    useConfigStore.getState().addEquipmentSlot({
      type: 'head',
      name: 'Head',
      description: '',
      placement: { column: 2, row: 1, glyph: 'helm' },
    });

    render(<EquipmentSlotsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/^Display Name/), { target: { value: 'Headgear' } });
    fireEvent.submit(screen.getByLabelText(/^Display Name/).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(useConfigStore.getState().config?.equipmentSlots[0]).toEqual({
        type: 'head',
        name: 'Headgear',
        description: '',
        placement: { column: 2, row: 1, glyph: 'helm' },
      });
    });
  });

  it('should refuse to draw anything without a configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });
});
