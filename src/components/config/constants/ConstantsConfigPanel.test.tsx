/**
 * Constants Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the cards show is what the ruleset actually
 * holds. The two things worth asserting through the DOM rather than the hook are Concept 05's
 * editor requirement — the usage list on the card matching the formulas that really name the
 * constant — and TICKET-REF-02's refusal surfacing as a dialog rather than a silent no-op.
 *
 * **Validates: Concept 05; Concept 00 §6; Requirements 2.5, 2.6, 21.1-21.5**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
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
import { ConstantsConfigPanel } from './ConstantsConfigPanel';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 6,
  stats: [
    {
      id: 'str-id',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'bonus',
      name: 'Bonus',
      abbreviation: 'BON',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
      formula: 'STR / const.bonus_divider',
    },
    // Names the *stat* member, not the constant — the walker keeps namespaces apart
    {
      id: 'plain',
      name: 'Plain',
      abbreviation: 'PLA',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
      formula: 'STR * 2',
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
  constants: [
    {
      id: 'div-id',
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description: 'Levels per point of bonus.',
      value: 5,
    },
    {
      id: 'apt-id',
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack.',
      value: 30,
      unit: 'speed',
    },
  ],
  focusStatBonusLevel: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

/**
 * The card whose heading is `displayName` — cards are siblings, so scope queries to one of them
 *
 * Anchored on the panel's own list item rather than on a `Card` class, so restyling the primitive
 * cannot break a feature test.
 */
function cardFor(displayName: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: displayName });
  const card = heading.closest('li');
  if (!card) throw new Error(`No card found for ${displayName}`);
  return card;
}

describe('ConstantsConfigPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should show each constant with its formula name, value and description', () => {
    render(<ConstantsConfigPanel />);

    const card = cardFor('Bonus divider');
    expect(within(card).getByText('const.bonus_divider')).toBeDefined();
    expect(within(card).getByText('5')).toBeDefined();
    expect(within(card).getByText('Levels per point of bonus.')).toBeDefined();
    expect(within(cardFor('APT value')).getByText('speed')).toBeDefined();
  });

  it('should list the formulas that name a constant, and only those', () => {
    render(<ConstantsConfigPanel />);

    const used = within(cardFor('Bonus divider'));
    expect(used.getByText(/Stat: Bonus/)).toBeDefined();
    expect(used.queryByText(/Stat: Plain/)).toBeNull();

    expect(
      within(cardFor('APT value')).getByText(/No formula names this constant yet/)
    ).toBeTruthy();
  });

  it('should follow a formula when the constant it names is renamed', () => {
    useConfigStore.setState({
      config: {
        ...structuredClone(config),
        constants: [
          {
            id: 'div-id',
            name: 'bonus_scale',
            displayName: 'Bonus divider',
            description: 'Levels per point of bonus.',
            value: 5,
          },
        ],
        stats: [
          {
            id: 'bonus',
            name: 'Bonus',
            abbreviation: 'BON',
            description: '',
            order: 0,
            countsTowardTotal: true,
            isResource: false,
            rounding: 'none',
            formula: 'STR / const.bonus_scale',
          },
        ],
      },
    });

    render(<ConstantsConfigPanel />);

    expect(within(cardFor('Bonus divider')).getByText(/Stat: Bonus/)).toBeDefined();
  });

  it('should refuse to delete a referenced constant, naming what points at it', () => {
    render(<ConstantsConfigPanel />);

    fireEvent.click(within(cardFor('Bonus divider')).getByRole('button', { name: 'Delete' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Still In Use' }));
    expect(dialog.getByText(/Constant Bonus divider cannot be deleted/)).toBeDefined();
    expect(dialog.getByText(/Stat: Bonus/)).toBeDefined();
    expect(useConfigStore.getState().config?.constants).toHaveLength(2);
  });

  it('should delete an unreferenced constant without a dialog', () => {
    render(<ConstantsConfigPanel />);

    fireEvent.click(within(cardFor('APT value')).getByRole('button', { name: 'Delete' }));

    expect(screen.queryByText('Still In Use')).toBeNull();
    expect(useConfigStore.getState().config?.constants?.map((c) => c.id)).toEqual(['div-id']);
  });

  it('should require a description before a new constant can be saved', async () => {
    render(<ConstantsConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Constant' }));

    const dialog = within(screen.getByRole('dialog', { name: 'Add Constant' }));
    fireEvent.change(dialog.getByLabelText(/Display Name/), { target: { value: 'Crit' } });
    fireEvent.change(dialog.getByLabelText(/Formula Name/), { target: { value: 'crit_mult' } });
    fireEvent.change(dialog.getByLabelText(/Value/), { target: { value: '2' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Add Constant' }));

    // Concept 05 — a constant nobody understands is worse than the literal it replaced
    expect(await screen.findByText('Description is required')).toBeDefined();
    expect(useConfigStore.getState().config?.constants).toHaveLength(2);
  });

  it('should show the empty state for a ruleset with no constants', () => {
    useConfigStore.setState({ config: { ...structuredClone(config), constants: [] } });

    render(<ConstantsConfigPanel />);

    expect(screen.getByText(/No constants configured yet/)).toBeDefined();
  });
});
