/**
 * Stats Config Panel Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsConfigPanel } from './StatsConfigPanel';
import { useConfigStore } from '../../../stores/configStore';

// Mock the config store
vi.mock('../../../stores/configStore');

describe('StatsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render no configuration message when config is null', () => {
    vi.mocked(useConfigStore).mockReturnValue(null);

    render(<StatsConfigPanel />);

    expect(screen.getByText(/no configuration loaded/i)).toBeDefined();
  });

  it('should render empty state when no stats exist', () => {
    vi.mocked(useConfigStore).mockReturnValue({
      config: {
        id: '1',
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
      },
      isLoaded: true,
      addStat: vi.fn(),
      updateStat: vi.fn(),
      deleteStat: vi.fn(),
    } as any);

    render(<StatsConfigPanel />);

    expect(screen.getByText(/no stats configured yet/i)).toBeDefined();
    expect(screen.getByText(/add stat/i)).toBeDefined();
  });

  it('should render stats list when stats exist', () => {
    vi.mocked(useConfigStore).mockReturnValue({
      config: {
        id: '1',
        name: 'Test Config',
        version: '1.0.0',
        mainSkills: [
          { code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
          { code: 'CON', name: 'Constitution', description: '', maxLevel: 10 },
        ],
        stats: [
          {
            id: 'stat1',
            name: 'Health',
            description: 'Life force',
            formula: 'STR * 10 + CON * 5',
          },
        ],
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
      },
      isLoaded: true,
      addStat: vi.fn(),
      updateStat: vi.fn(),
      deleteStat: vi.fn(),
    } as any);

    render(<StatsConfigPanel />);

    expect(screen.getByText('Health')).toBeDefined();
    expect(screen.getByText('STR * 10 + CON * 5')).toBeDefined();
  });
});
