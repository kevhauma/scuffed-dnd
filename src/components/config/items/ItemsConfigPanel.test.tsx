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
    expect(screen.getByText('Items & Equipment')).toBeDefined();
  });

  it('displays add item button', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText('Add Item')).toBeDefined();
  });

  it('displays add equipment slot button', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText('Add Equipment Slot')).toBeDefined();
  });

  it('shows warning when no materials configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No materials configured yet/)).toBeDefined();
  });

  it('shows warning when no equipment slots configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No equipment slots configured yet/)).toBeDefined();
  });

  it('shows empty state when no items configured', () => {
    render(<ItemsConfigPanel />);
    expect(screen.getByText(/No items configured yet/)).toBeDefined();
  });
});
