/**
 * Main Skill Point Budget Tests
 *
 * **Validates: Requirements 2.4**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../../types/config';

vi.mock('../../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../../stores/configStore';
import { MainSkillPointBudget } from './MainSkillPointBudget';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
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
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('MainSkillPointBudget', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  it('should show an empty field and say unlimited when no budget is set', () => {
    render(<MainSkillPointBudget />);

    expect((screen.getByLabelText(/Total points/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Unlimited/)).toBeDefined();
  });

  it('should show the saved budget', () => {
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });

    render(<MainSkillPointBudget />);

    expect((screen.getByLabelText(/Total points/i) as HTMLInputElement).value).toBe('12');
    expect(screen.getByText(/Players may spend 12 of the 20 levels/)).toBeDefined();
  });

  it('should save a budget through the store action', () => {
    render(<MainSkillPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBe(15);
  });

  it('should clear the budget back to unlimited when the field is emptied', () => {
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });
    render(<MainSkillPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBeUndefined();
  });

  it('should refuse a negative budget and explain why', () => {
    render(<MainSkillPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '-4' } });

    expect(screen.getByText(/whole number of 0 or more/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBeUndefined();
  });

  it('should disable Save until something changes', () => {
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });
    render(<MainSkillPointBudget />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '13' } });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });
});
