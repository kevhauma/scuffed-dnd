/**
 * Currency Config Panel Tests
 * 
 * Tests for currency tier management functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CurrencyConfigPanel } from './CurrencyConfigPanel';
import { useConfigStore } from '../../../stores/configStore';
import type { Configuration, CurrencyTier } from '../../../types';

// Mock the config store
vi.mock('../../../stores/configStore');

describe('CurrencyConfigPanel', () => {
  const mockConfig: Configuration = {
    id: 'test-config',
    name: 'Test Config',
    version: '1.0.0',
    mainSkills: [],
    stats: [],
    specialitySkills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTiers: CurrencyTier[] = [
    {
      id: 'tier-1',
      name: 'Copper',
      order: 0,
      conversionToNext: 100,
    },
    {
      id: 'tier-2',
      name: 'Silver',
      order: 1,
      conversionToNext: 100,
    },
    {
      id: 'tier-3',
      name: 'Gold',
      order: 2,
      conversionToNext: 1,
    },
  ];

  const mockAddCurrencyTier = vi.fn();
  const mockUpdateCurrencyTier = vi.fn();
  const mockDeleteCurrencyTier = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: { ...mockConfig, currencyTiers: mockTiers },
        addCurrencyTier: mockAddCurrencyTier,
        updateCurrencyTier: mockUpdateCurrencyTier,
        deleteCurrencyTier: mockDeleteCurrencyTier,
      };
      return selector(state);
    });
  });

  it('renders currency tiers list', () => {
    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText('Copper')).toBeDefined();
    expect(screen.getByText('Silver')).toBeDefined();
    expect(screen.getByText('Gold')).toBeDefined();
  });

  it('displays conversion rates correctly', () => {
    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText(/100 Copper = 1 \(next tier\)/)).toBeDefined();
    expect(screen.getByText(/100 Silver = 1 \(next tier\)/)).toBeDefined();
  });

  it('marks highest tier correctly', () => {
    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText('Highest value tier')).toBeDefined();
  });

  it('opens add dialog when Add Currency Tier is clicked', async () => {
    render(<CurrencyConfigPanel />);
    
    const addButton = screen.getByText('Add Currency Tier');
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText('Add Currency Tier')).toBeDefined();
    });
  });

  it('shows empty state when no tiers exist', () => {
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: { ...mockConfig, currencyTiers: [] },
        addCurrencyTier: mockAddCurrencyTier,
        updateCurrencyTier: mockUpdateCurrencyTier,
        deleteCurrencyTier: mockDeleteCurrencyTier,
      };
      return selector(state);
    });

    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText(/No currency tiers configured yet/)).toBeDefined();
  });

  it('disables move up button for first tier', () => {
    render(<CurrencyConfigPanel />);
    
    const cards = screen.getAllByRole('button', { name: '▲' });
    expect(cards[0].hasAttribute('disabled')).toBe(true);
  });

  it('disables move down button for last tier', () => {
    render(<CurrencyConfigPanel />);
    
    const cards = screen.getAllByRole('button', { name: '▼' });
    expect(cards[cards.length - 1].hasAttribute('disabled')).toBe(true);
  });

  it('shows conversion calculator when multiple tiers exist', () => {
    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText('Conversion Calculator')).toBeDefined();
  });

  it('does not show conversion calculator with single tier', () => {
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: { ...mockConfig, currencyTiers: [mockTiers[0]] },
        addCurrencyTier: mockAddCurrencyTier,
        updateCurrencyTier: mockUpdateCurrencyTier,
        deleteCurrencyTier: mockDeleteCurrencyTier,
      };
      return selector(state);
    });

    render(<CurrencyConfigPanel />);
    
    expect(screen.queryByText('Conversion Calculator')).toBeNull();
  });

  it('calls delete when delete button is clicked', () => {
    render(<CurrencyConfigPanel />);
    
    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);
    
    expect(mockDeleteCurrencyTier).toHaveBeenCalledWith('tier-1');
  });

  it('shows no config message when config is null', () => {
    (useConfigStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        config: null,
        addCurrencyTier: mockAddCurrencyTier,
        updateCurrencyTier: mockUpdateCurrencyTier,
        deleteCurrencyTier: mockDeleteCurrencyTier,
      };
      return selector(state);
    });

    render(<CurrencyConfigPanel />);
    
    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
  });
});
