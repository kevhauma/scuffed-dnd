/**
 * Equipment Slots Configuration Panel Tests
 * 
 * Tests for the EquipmentSlotsConfigPanel component.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EquipmentSlotsConfigPanel } from './EquipmentSlotsConfigPanel';
import { useConfigStore } from '../../../stores/configStore';

// Mock the config store
vi.mock('../../../stores/configStore');

describe('EquipmentSlotsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render no configuration message when config is null', () => {
    vi.mocked(useConfigStore).mockReturnValue(null);

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText(/no configuration loaded/i)).toBeDefined();
  });

  it('should render empty state when no equipment slots exist', () => {
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
      addEquipmentSlot: vi.fn(),
      updateEquipmentSlot: vi.fn(),
      deleteEquipmentSlot: vi.fn(),
    } as any);

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText(/no equipment slots configured yet/i)).toBeDefined();
    expect(screen.getByText(/add equipment slot/i)).toBeDefined();
  });

  it('should render equipment slots list when slots exist', () => {
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
        equipmentSlots: [
          {
            type: 'helmet',
            name: 'Helmet',
            description: 'Head protection',
          },
          {
            type: 'main_hand',
            name: 'Main Hand',
            description: 'Primary weapon slot',
          },
          {
            type: 'off_hand',
            name: 'Off Hand',
            description: 'Secondary weapon or shield slot',
          },
        ],
        races: [],
        currencyTiers: [],
        focusStatBonusLevel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoaded: true,
      addEquipmentSlot: vi.fn(),
      updateEquipmentSlot: vi.fn(),
      deleteEquipmentSlot: vi.fn(),
    } as any);

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText('Helmet')).toBeDefined();
    expect(screen.getByText('Main Hand')).toBeDefined();
    expect(screen.getByText('Off Hand')).toBeDefined();
    expect(screen.getByText('Head protection')).toBeDefined();
    expect(screen.getByText('Primary weapon slot')).toBeDefined();
  });

  it('should display equipment slot types', () => {
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
        equipmentSlots: [
          {
            type: 'helmet',
            name: 'Helmet',
            description: 'Head protection',
          },
        ],
        races: [],
        currencyTiers: [],
        focusStatBonusLevel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      isLoaded: true,
      addEquipmentSlot: vi.fn(),
      updateEquipmentSlot: vi.fn(),
      deleteEquipmentSlot: vi.fn(),
    } as any);

    render(<EquipmentSlotsConfigPanel />);

    expect(screen.getByText('Type: helmet')).toBeDefined();
  });
});
