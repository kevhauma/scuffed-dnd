/**
 * Materials Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the level dialog offers is what the ruleset
 * actually holds and a save really goes through `updateMaterial`.
 *
 * What is asserted through the DOM is TICKET-MAT-01's whole point: a tier's modifiers target
 * **stats** — resources included, so "+50 max Mana" is expressible — and never a derived stat,
 * whose formula is its only source.
 *
 * **Validates: Concept 09; Requirements 6.4, 6.5, 6.6, 21.1-21.5**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration, Stat } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { MaterialsConfigPanel } from './MaterialsConfigPanel';

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
      stat({ id: 'mana-id', name: 'Mana', abbreviation: 'MANA', order: 1, isResource: true }),
      stat({ id: 'apt-id', name: 'APT', abbreviation: 'APT', order: 2, formula: 'STR / 2' }),
    ],
    skills: [
      {
        id: 'STL',
        name: 'Stealth',
        description: '',
        statWeights: [{ statId: 'str-id', weight: 0.2 }],
      },
    ],
    materials: [
      {
        id: 'fur',
        name: 'Fur',
        description: '',
        categoryId: 'cloth',
        levels: [
          {
            level: 1,
            name: 'Fur 1',
            bonuses: [{ statId: 'mana-id', modifier: 50 }],
            value: { tierId: 'gold', amount: 10 },
          },
        ],
      },
    ],
    materialCategories: [{ id: 'cloth', name: 'Cloth', description: '' }],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [{ id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 }],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** A material's levels are collapsed until its card is expanded */
const expandMaterial = () => fireEvent.click(screen.getByRole('button', { name: '▶' }));

/** Open the one material tier's editor — the last Edit is the level's, below the category's and
 * the material's */
const openLevelEditor = () => {
  expandMaterial();
  const edits = screen.getAllByRole('button', { name: 'Edit' });
  fireEvent.click(edits[edits.length - 1]);
};

/** A badge's text is split across nodes, so it is matched on the span's whole content */
const badge = (text: string) =>
  screen.getByText(
    (_content, element) => element?.tagName === 'SPAN' && element.textContent === text
  );

/** The stat picker on the first bonus row */
const targetPicker = () => screen.getAllByRole('combobox')[0] as HTMLSelectElement;

describe('MaterialsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
  });

  it('should show a tier bonus by the stat it targets, not by its id', () => {
    render(<MaterialsConfigPanel />);
    expandMaterial();

    // The stored form is `mana-id`; a User reads MANA
    expect(badge('MANA: +50')).toBeDefined();
  });

  it('should offer invested and resource stats as modifier targets', () => {
    render(<MaterialsConfigPanel />);
    openLevelEditor();

    const options = Array.from(targetPicker().options).map((option) => option.textContent);

    expect(options).toContain('Strength (STR)');
    expect(options).toContain('Mana (MANA)'); // a resource — "+50 max Mana" is the point
  });

  it('should not offer a derived stat, whose formula is its only source', () => {
    render(<MaterialsConfigPanel />);
    openLevelEditor();

    const options = Array.from(targetPicker().options).map((option) => option.textContent);

    expect(options).not.toContain('APT (APT)');
    expect(options).toHaveLength(2);
  });

  it('should no longer offer a speciality or combat skill as a target', () => {
    // A tier modifier lands on a stat now (Concept 09); a skill follows through the stats its
    // formula reads rather than being named directly
    render(<MaterialsConfigPanel />);
    openLevelEditor();

    const options = Array.from(targetPicker().options).map((option) => option.value);

    expect(options).not.toContain('STL');
  });

  it('should persist an edited modifier as a stat id, through the store', async () => {
    render(<MaterialsConfigPanel />);
    openLevelEditor();

    fireEvent.change(targetPicker(), { target: { value: 'str-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Level' }));

    await waitFor(() => {
      expect(useConfigStore.getState().config?.materials[0].levels[0].bonuses).toEqual([
        { statId: 'str-id', modifier: 50 },
      ]);
    });
  });

  it('should sort the tier picker without reordering the store (CR-15)', () => {
    // Stored deliberately out of order, so an in-place sort would be visible in the store
    useConfigStore.setState({
      config: createConfig({
        currencyTiers: [
          { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
          { id: 'gold', name: 'Gold', order: 0, conversionToNext: 10 },
        ],
      }),
      isLoaded: true,
    });

    render(<MaterialsConfigPanel />);
    openLevelEditor();

    // The picker still reads in `order`, and the store's array is untouched by the render
    const tierPicker = screen.getByLabelText('Currency Tier') as HTMLSelectElement;
    expect(Array.from(tierPicker.options).map((option) => option.value)).toEqual([
      'gold',
      'silver',
    ]);
    expect(useConfigStore.getState().config?.currencyTiers.map((tier) => tier.id)).toEqual([
      'silver',
      'gold',
    ]);
  });

  it('should say there is nothing to modify when every stat is derived', () => {
    useConfigStore.setState({
      config: createConfig({
        stats: [stat({ id: 'apt-id', name: 'APT', abbreviation: 'APT', formula: '1' })],
      }),
      isLoaded: true,
    });

    render(<MaterialsConfigPanel />);
    openLevelEditor();

    // The panel's own guidance says it too, so this matches the dialog's wording specifically
    expect(screen.getByText(/A derived stat takes its value from its formula/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add Bonus' })).toHaveProperty('disabled', true);
  });
});
