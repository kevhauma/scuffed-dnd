/**
 * Config Dashboard Tests
 *
 * The stores are real with storage mocked, so validating really writes the report to `useUIStore`.
 * Navigation is mocked at the router boundary — the section links are `<Link>`s.
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 21.1-21.5**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '../../../types/config';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import { ConfigDashboard } from './ConfigDashboard';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 8,
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
        id: 'health',
        name: 'Health',
        abbreviation: 'HEA',
        description: '',
        order: 0,
        countsTowardTotal: true,
        isResource: true,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [{ id: 'metal', name: 'Metal', description: '' }],
    items: [],
    equipmentSlots: [{ type: 'helmet', name: 'Helmet', description: '' }],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function validate() {
  fireEvent.click(screen.getByRole('button', { name: 'Validate Configuration' }));
}

describe('ConfigDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useUIStore.setState({ validationReport: null });
  });

  it('should show the validation status without being asked', () => {
    render(<ConfigDashboard />);

    // Requirement 18.6
    expect(screen.getByText('This ruleset is valid.')).toBeDefined();
  });

  it('should show an error count for an invalid configuration without being asked', () => {
    useConfigStore.setState({
      config: createConfig({
        stats: [
          {
            id: 'health',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: true,
            rounding: 'none',
            formula: 'NOPE * 10',
          },
        ],
      }),
    });

    render(<ConfigDashboard />);

    expect(screen.getByText(/1 error\(s\)/)).toBeDefined();
    expect(screen.queryByText('This ruleset is valid.')).toBeNull();
  });

  it('should display a report when the User asks, even for a clean ruleset', () => {
    render(<ConfigDashboard />);

    validate();

    // Requirement 18.5 — the primitive's own empty state
    expect(screen.getByText('Validation Report')).toBeDefined();
  });

  it('should store the report in the UI store rather than in component state', () => {
    render(<ConfigDashboard />);

    expect(useUIStore.getState().validationReport).toBeNull();

    validate();

    expect(useUIStore.getState().validationReport?.isValid).toBe(true);
  });

  it('should report a formula reference to a skill that does not exist', () => {
    useConfigStore.setState({
      config: createConfig({
        stats: [
          {
            id: 'health',
            name: 'Health',
            abbreviation: 'HEA',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: true,
            rounding: 'none',
            formula: 'WIS * 10',
          },
        ],
      }),
    });

    render(<ConfigDashboard />);
    validate();

    // Requirement 18.1
    expect(screen.getByText(/WIS/)).toBeDefined();
  });

  it('should report a circular dependency between formulas', () => {
    useConfigStore.setState({
      config: createConfig({
        // Written over combat skills since TICKET-SKL-02: a `Skill` holds weight rows rather
        // than a formula, so two of them cannot reference each other at all
        combatSkills: [
          {
            id: 'AAA',
            code: 'AAA',
            name: 'A',
            description: '',
            dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
            bonusFormula: 'BBB',
          },
          {
            id: 'BBB',
            code: 'BBB',
            name: 'B',
            description: '',
            dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
            bonusFormula: 'AAA',
          },
        ],
      }),
    });

    render(<ConfigDashboard />);
    validate();

    // Requirement 18.2
    expect(screen.getByText(/[Cc]ircular/)).toBeDefined();
  });

  it('should report an item referencing an equipment slot type that does not exist', () => {
    useConfigStore.setState({
      config: createConfig({
        items: [{ id: 'boots', name: 'Boots', description: '', equipmentSlotType: 'feet' }],
      }),
    });

    render(<ConfigDashboard />);
    validate();

    // Requirement 18.3
    expect(screen.getByText(/feet/)).toBeDefined();
  });

  it('should report a material referencing a category that does not exist', () => {
    useConfigStore.setState({
      config: createConfig({
        materials: [{ id: 'iron', name: 'Iron', description: '', categoryId: 'ore', levels: [] }],
      }),
    });

    render(<ConfigDashboard />);
    validate();

    // Requirement 18.4
    expect(screen.getByText(/ore/)).toBeDefined();
  });

  it('should still offer to initialize when there is no configuration', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<ConfigDashboard />);

    expect(screen.getByText('No Configuration Found')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Validate Configuration' })).toBeNull();
  });

  it('should still show the loading state before hydration finishes', () => {
    useConfigStore.setState({ config: null, isLoaded: false });

    render(<ConfigDashboard />);

    expect(screen.getByText('Loading configuration...')).toBeDefined();
  });

  it('should link to every configuration area', () => {
    render(<ConfigDashboard />);

    for (const label of [
      'Skills',
      'Stats',
      'Materials',
      'Items',
      'Races',
      'Archetypes',
      'Currency',
      'Constants',
      'Curves',
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });
});
