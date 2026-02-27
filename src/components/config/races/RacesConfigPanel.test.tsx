/**
 * Races Configuration Panel Tests
 * 
 * Tests for the RacesConfigPanel component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RacesConfigPanel } from './RacesConfigPanel';
import { useConfigStore } from '../../../stores/configStore';

// Mock the config store
vi.mock('../../../stores/configStore');

describe('RacesConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render no configuration message when config is null', () => {
    vi.mocked(useConfigStore).mockReturnValue(null);

    render(<RacesConfigPanel />);

    expect(screen.getByText(/no configuration loaded/i)).toBeDefined();
  });

  it('should render empty state when no races exist', () => {
    vi.mocked(useConfigStore).mockReturnValue({
      config: {
        id: '1',
        name: 'Test Config',
        version: '1.0.0',
        mainSkills: [
          { code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
          { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 10 },
        ],
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
      addRace: vi.fn(),
      updateRace: vi.fn(),
      deleteRace: vi.fn(),
    } as any);

    render(<RacesConfigPanel />);

    expect(screen.getByText(/no races configured yet/i)).toBeDefined();
    expect(screen.getByText(/add race/i)).toBeDefined();
  });

  it('should render races list when races exist', () => {
    vi.mocked(useConfigStore).mockReturnValue({
      config: {
        id: '1',
        name: 'Test Config',
        version: '1.0.0',
        mainSkills: [
          { code: 'STR', name: 'Strength', description: '', maxLevel: 10 },
          { code: 'DEX', name: 'Dexterity', description: '', maxLevel: 10 },
        ],
        stats: [],
        specialitySkills: [],
        combatSkills: [],
        materials: [],
        materialCategories: [],
        items: [],
        equipmentSlots: [],
        races: [
          {
            id: 'race1',
            name: 'Elf',
            description: 'Graceful beings',
            skillModifiers: [
              { skillCode: 'DEX', modifier: 2 },
              { skillCode: 'STR', modifier: -1 },
            ],
          },
          {
            id: 'race2',
            name: 'Dwarf',
            description: 'Sturdy folk',
            skillModifiers: [
              { skillCode: 'STR', modifier: 2 },
              { skillCode: 'DEX', modifier: -1 },
            ],
          },
        ],
        currencyTiers: [],
        focusStatBonusLevel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoaded: true,
      addRace: vi.fn(),
      updateRace: vi.fn(),
      deleteRace: vi.fn(),
    } as any);

    render(<RacesConfigPanel />);

    expect(screen.getByText('Elf')).toBeDefined();
    expect(screen.getByText('Dwarf')).toBeDefined();
    expect(screen.getByText('Graceful beings')).toBeDefined();
    expect(screen.getByText('Sturdy folk')).toBeDefined();
  });

  it('should show warning when no main skills configured', () => {
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
      addRace: vi.fn(),
      updateRace: vi.fn(),
      deleteRace: vi.fn(),
    } as any);

    render(<RacesConfigPanel />);

    expect(screen.getByText(/no main skills configured yet/i)).toBeDefined();
  });
});
