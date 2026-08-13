/**
 * Races Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the panel shows is what the ruleset actually
 * holds and a save really goes through `updateRace`.
 *
 * The two things asserted through the DOM are TICKET-RACE-01's whole point: a race is edited as
 * **absolute values** rather than as ± rows, and the block's shape is decided by the ruleset's
 * stats — add a stat and every race grows a row for it, at 0, rather than becoming half-defined.
 *
 * **Validates: Concept 04; Requirements 8.1, 8.2, 21.1-21.5**
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration, Stat } from '../../../types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { RacesConfigPanel } from './RacesConfigPanel';

function stat(overrides: Partial<Stat> & Pick<Stat, 'id' | 'name' | 'abbreviation'>): Stat {
  return {
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...overrides,
  };
}

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 5,
    stats: [
      stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
      stat({ id: 'dex-id', name: 'Dexterity', abbreviation: 'DEX', order: 1 }),
    ],
    skills: [],
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [
      {
        id: 'dwarf',
        name: 'Dwarf',
        description: 'Stout',
        statValues: { 'str-id': 14, 'dex-id': 3 },
      },
    ],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const openEditor = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

describe('RacesConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  /** One stat's cell on a race card, read as "<name><value>" */
  const cellFor = (statName: string) => screen.getByText(statName).parentElement?.textContent ?? '';

  it('should show a race as a stat block over every configured stat', () => {
    render(<RacesConfigPanel />);

    expect(screen.getByText('Dwarf')).toBeDefined();
    expect(cellFor('Strength')).toBe('Strength14');
    expect(cellFor('Dexterity')).toBe('Dexterity3');
  });

  it('should total only the stats the ruleset counts', () => {
    // Concept 01's six-core rule is what makes "human 60, elf 64" checkable against the sheet
    useConfigStore.setState({
      config: createConfig({
        stats: [
          stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
          stat({
            id: 'dex-id',
            name: 'Dexterity',
            abbreviation: 'DEX',
            order: 1,
            countsTowardTotal: false,
          }),
        ],
      }),
      isLoaded: true,
    });

    render(<RacesConfigPanel />);

    expect(screen.getByText('Counted total:').parentElement?.textContent).toBe('Counted total:14');
    expect(screen.getByText('All stats:').parentElement?.textContent).toBe('All stats:17');
  });

  it('should edit absolute values rather than deltas, and persist through the store', async () => {
    render(<RacesConfigPanel />);
    openEditor();

    const strength = screen.getByLabelText('Strength (STR)') as HTMLInputElement;
    expect(strength.value).toBe('14');

    fireEvent.change(strength, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Race' }));

    await waitFor(() => {
      expect(useConfigStore.getState().config?.races[0].statValues).toEqual({
        'str-id': 15,
        'dex-id': 3,
      });
    });
  });

  it('should gain a row when a stat is added to the ruleset, defaulting it to 0', async () => {
    render(<RacesConfigPanel />);

    // The race said nothing about Wisdom, because Wisdom did not exist when it was written
    act(() => {
      useConfigStore
        .getState()
        .addStat(stat({ id: 'wis-id', name: 'Wisdom', abbreviation: 'WIS' }));
    });

    openEditor();

    expect((screen.getByLabelText('Wisdom (WIS)') as HTMLInputElement).value).toBe('0');

    fireEvent.change(screen.getByLabelText('Wisdom (WIS)'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Race' }));

    // The stat is picked up even though it did not exist when the dialog's defaults were built
    await waitFor(() => {
      expect(useConfigStore.getState().config?.races[0].statValues['wis-id']).toBe(7);
    });
  });

  it('should store a block without its zeros, so a zero is not a reference', async () => {
    // A dense block would make `deleteStat` refuse for every stat every race was ever saved over
    // (TICKET-REF-02's guard reads a non-zero entry as "this race points at that stat")
    render(<RacesConfigPanel />);
    openEditor();

    fireEvent.change(screen.getByLabelText('Dexterity (DEX)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Race' }));

    await waitFor(() => {
      expect(useConfigStore.getState().config?.races[0].statValues).toEqual({ 'str-id': 14 });
    });
  });

  it('should say why there is nothing to edit when the ruleset has no stats', () => {
    useConfigStore.setState({ config: createConfig({ stats: [], races: [] }), isLoaded: true });

    render(<RacesConfigPanel />);

    expect(screen.getByText(/A race is a stat block, so add stats first/)).toBeDefined();
  });
});
