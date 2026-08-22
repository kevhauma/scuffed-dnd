/**
 * Items Configuration Panel Tests
 *
 * Tests for the ItemsConfigPanel component.
 */

import { render, screen } from '@testing-library/react';
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

    // `EquipmentSlotsConfigPanel` owns the slot flow, and `/config/items` mounts it below this
    // one — a second Add button and a second dialog here were two copies of the same entity
    expect(screen.queryByRole('button', { name: 'Add Equipment Slot' })).toBeNull();
  });

  it('shows warning when no materials configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No materials configured yet/)).toBeDefined();
  });

  it('points at the panel below when no equipment slots are configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/Equipment Slots panel below/)).toBeDefined();
  });

  it('shows empty state when no items configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No items configured yet/)).toBeDefined();
  });
});
