/**
 * Items Configuration Panel Tests
 *
 * Tests for the ItemsConfigPanel component.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useConfigStore } from '../../../stores/configStore';
import { ItemsConfigPanel } from './ItemsConfigPanel';

describe('ItemsConfigPanel', () => {
  beforeEach(() => {
    // Initialize empty config
    useConfigStore.getState().initializeConfig('Test Config');
  });

  it('renders without crashing', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByRole('heading', { name: 'Items' })).toBeDefined();
  });

  it('displays add item button', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText('Add Item')).toBeDefined();
  });

  it('does not manage equipment slots itself (CR-20)', () => {
    render(<ItemsConfigPanel />);

    // `EquipmentSlotsConfigPanel` owns the slot flow, on `/config/equipment` since TICKET-INV-02 —
    // a second Add button and a second dialog here were two copies of the same entity
    expect(screen.queryByRole('button', { name: 'Add Equipment Slot' })).toBeNull();
  });

  it('shows warning when no materials configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No materials configured yet/)).toBeDefined();
  });

  it('points at the equipment page when no equipment slots are configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/Configuration → Equipment/)).toBeDefined();
  });

  it('shows empty state when no items configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No items configured yet/)).toBeDefined();
  });

  it('reports a refused save through the shared field, not a raw span (CR-23)', async () => {
    render(<ItemsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));

    // `FormField` associates the label, which the hand-rolled generation also did — what it also
    // brings is one error node instead of this file's `<span className="text-xs text-crimson">`
    const nameField = screen.getByLabelText(/^Name/);
    fireEvent.submit(nameField.closest('form') as HTMLFormElement);

    await waitFor(() => {
      const message = screen.getByText('Name is required');
      // `Text variant="error"`'s ground, the one every other dialog's refusal renders in
      expect(message.className).toContain('text-crimson');
    });
  });
});
