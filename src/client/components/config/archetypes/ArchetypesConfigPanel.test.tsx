/**
 * Archetypes Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the panel shows is what the ruleset actually holds
 * and a save really goes through `addArchetype` / `updateArchetype`.
 *
 * The things asserted through the DOM are TICKET-ARC-01's point: an archetype tags **every**
 * configured stat, the table's shape is decided by the ruleset's stats — add a stat and every
 * archetype grows a row for it, at `non` — and a tagging is stored **sparsely**, so a `non` is
 * absence rather than a reference that would block deleting the stat.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration, Stat } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { ArchetypesConfigPanel } from './ArchetypesConfigPanel';

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
    schemaVersion: 9,
    stats: [
      stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
      stat({ id: 'dex-id', name: 'Dexterity', abbreviation: 'DEX', order: 1 }),
    ],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    archetypes: [
      {
        id: 'strong',
        name: 'Strong',
        description: 'Built for raw physical force',
        // Sparse: DEX is untagged, which *is* `non` (Concept 03)
        statAffinity: { 'str-id': 'main' },
      },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const openEditor = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
const storedArchetypes = () => useConfigStore.getState().config?.archetypes ?? [];

describe('ArchetypesConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    // The guarded-delete case writes a character; both stores are module state, so both are reset
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should group an archetype’s stats by affinity, showing untagged ones as non', () => {
    render(<ArchetypesConfigPanel />);

    expect(screen.getByText('Strong')).toBeDefined();
    // STR is tagged main; DEX is absent from the record and reads as non
    expect(screen.getByText('Main').parentElement?.textContent).toBe('MainSTR');
    expect(screen.getByText('Non').parentElement?.textContent).toBe('NonDEX');
  });

  it('should offer a row per configured stat, defaulting an untagged one to non', () => {
    render(<ArchetypesConfigPanel />);
    openEditor();

    expect((screen.getByLabelText('Strength (STR)') as HTMLSelectElement).value).toBe('main');
    expect((screen.getByLabelText('Dexterity (DEX)') as HTMLSelectElement).value).toBe('non');
  });

  it('should grow a row when a stat is added to the ruleset', () => {
    act(() => {
      useConfigStore.setState({
        config: createConfig({
          stats: [
            stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
            stat({ id: 'dex-id', name: 'Dexterity', abbreviation: 'DEX', order: 1 }),
            stat({ id: 'wis-id', name: 'Wisdom', abbreviation: 'WIS', order: 2 }),
          ],
        }),
        isLoaded: true,
      });
    });

    render(<ArchetypesConfigPanel />);
    openEditor();

    // The archetype has no opinion about Wisdom, so the ruleset gives it one rather than leaving
    // the archetype half-tagged
    expect((screen.getByLabelText('Wisdom (WIS)') as HTMLSelectElement).value).toBe('non');
  });

  it('should save a changed affinity through the store', async () => {
    render(<ArchetypesConfigPanel />);
    openEditor();

    fireEvent.change(screen.getByLabelText('Dexterity (DEX)'), { target: { value: 'sub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Archetype' }));

    await waitFor(() => {
      expect(storedArchetypes()[0].statAffinity).toEqual({ 'str-id': 'main', 'dex-id': 'sub' });
    });
  });

  it('should store a tagging sparsely, dropping a stat set back to non', async () => {
    render(<ArchetypesConfigPanel />);
    openEditor();

    fireEvent.change(screen.getByLabelText('Strength (STR)'), { target: { value: 'non' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Archetype' }));

    await waitFor(() => {
      // Not `{ 'str-id': 'non' }` — a stored non would read as a reference and make deleting the
      // stat refuse for every archetype ever saved over it
      expect(storedArchetypes()[0].statAffinity).toEqual({});
    });
  });

  it('should add a new archetype through the store', async () => {
    render(<ArchetypesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Archetype' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Sneaky' } });
    fireEvent.change(screen.getByLabelText('Dexterity (DEX)'), { target: { value: 'main' } });
    // The dialog's submit, not the panel's open-the-dialog button of the same name
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Add Archetype' }).find((button) => {
        return (button as HTMLButtonElement).type === 'submit';
      }) as HTMLElement
    );

    await waitFor(() => {
      expect(storedArchetypes()).toHaveLength(2);
    });
    expect(storedArchetypes()[1].name).toBe('Sneaky');
    expect(storedArchetypes()[1].statAffinity).toEqual({ 'dex-id': 'main' });
  });

  it('should say what is missing when the ruleset has no stats yet', () => {
    act(() => {
      useConfigStore.setState({
        config: createConfig({ stats: [], archetypes: [] }),
        isLoaded: true,
      });
    });

    render(<ArchetypesConfigPanel />);

    expect(screen.getByText(/An archetype tags stats, so add stats first/)).toBeDefined();
  });

  it('should refuse to delete an archetype a character is built on', async () => {
    // The guard is TICKET-REF-02's; what ARC-01 adds is the thing that can hold the reference
    act(() => {
      useCharacterStore.setState({
        characters: [
          {
            id: 'char1',
            name: 'Aria',
            configurationId: 'config1',
            raceIds: [],
            archetypeId: 'strong',
            investedStatPoints: {},
            investedSkillPoints: {},
            currentResourceValues: {},
            experience: 0,
            inventory: { equippedItems: {}, miscItems: [] },
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
        isLoaded: true,
      });
    });

    render(<ArchetypesConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText(/Aria/)).toBeDefined();
    });
    expect(storedArchetypes()).toHaveLength(1);
  });
});
