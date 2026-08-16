/**
 * Stat Point Budget Tests
 *
 * Carried over from the main-skills panel when stats became the invested atom (TICKET-STAT-01).
 * The arithmetic is unchanged; what it counts is not — the sentence names the ruleset's invested
 * stats rather than a sum of per-skill maximums, which retired with `MainSkill.maxLevel`.
 *
 * **Validates: Concept 01; Requirements 2.4**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { StatPointBudget } from './StatPointBudget';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 6,
    stats: [
      {
        id: 'STR',
        name: 'Strength',
        abbreviation: 'STR',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'DEX',
        name: 'Dexterity',
        abbreviation: 'DEX',
        description: '',
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
      },
      {
        id: 'hp',
        name: 'Health',
        abbreviation: 'HP',
        description: '',
        order: 2,
        countsTowardTotal: false,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [],
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

describe('StatPointBudget', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  it('should show an empty field and say unlimited when no budget is set', () => {
    render(<StatPointBudget />);

    expect((screen.getByLabelText(/Total points/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/Unlimited/)).toBeDefined();
  });

  it('should show the saved budget against the invested stats only', () => {
    // The derived stat takes no points, so it is not part of the count
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });

    render(<StatPointBudget />);

    expect((screen.getByLabelText(/Total points/i) as HTMLInputElement).value).toBe('12');
    expect(screen.getByText(/12 points across the 2 invested stats/)).toBeDefined();
  });

  it('should save a budget through the store action', () => {
    render(<StatPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBe(15);
  });

  it('should clear the budget back to unlimited when the field is emptied', () => {
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });
    render(<StatPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBeUndefined();
  });

  it('should refuse a negative budget and explain why', () => {
    render(<StatPointBudget />);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '-4' } });

    expect(screen.getByText(/whole number of 0 or more/i)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    expect(useConfigStore.getState().config?.mainSkillPointBudget).toBeUndefined();
  });

  it('should disable Save until something changes', () => {
    useConfigStore.setState({ config: createConfig({ mainSkillPointBudget: 12 }) });
    render(<StatPointBudget />);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    fireEvent.change(screen.getByLabelText(/Total points/i), { target: { value: '13' } });

    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });
});
