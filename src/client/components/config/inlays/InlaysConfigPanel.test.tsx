/**
 * Inlays Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the panel shows is what the ruleset actually holds
 * and a save really goes through `addInlay` / `updateInlay` / `deleteInlay`.
 *
 * The things asserted through the DOM are TICKET-INL-01's point: a family is a ladder of stat
 * grants, **a rung may be missing** and nothing renders one at zero, and the Common/Precious
 * headings are the ruleset's own words rather than a pair of names the app knows.
 *
 * **Validates: v4 systems/10; Requirements 21.1-21.5**
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration, Inlay, Stat } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { InlaysConfigPanel } from './InlaysConfigPanel';

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

/** Zircon as the sheet has it: nine rungs and a blank tenth, kept here as a gap of one */
const zircon: Inlay = {
  id: 'zircon',
  name: 'Zircon',
  description: 'A common stone',
  group: 'Common Gems',
  tiers: [
    { tier: 1, bonuses: [{ statId: 'dex-id', modifier: 1 }] },
    { tier: 9, bonuses: [{ statId: 'dex-id', modifier: 9 }] },
  ],
};

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
    inlays: [zircon],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const storedInlays = () => useConfigStore.getState().config?.inlays ?? [];
const expandZircon = () => fireEvent.click(screen.getByRole('button', { name: 'Expand Zircon' }));

describe('InlaysConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should list a family under the heading its group names', () => {
    render(<InlaysConfigPanel />);

    expect(screen.getByRole('heading', { name: 'Common Gems' })).toBeDefined();
    expect(screen.getByText('Zircon')).toBeDefined();
    expect(screen.getByText('(2 tiers)')).toBeDefined();
  });

  it('should draw no heading for a ruleset that groups nothing', () => {
    act(() => {
      useConfigStore.setState({
        config: createConfig({ inlays: [{ ...zircon, group: undefined }] }),
        isLoaded: true,
      });
    });

    render(<InlaysConfigPanel />);

    expect(screen.queryByRole('heading', { name: 'Common Gems' })).toBeNull();
    expect(screen.getByText('Zircon')).toBeDefined();
  });

  it('should render the rungs the family has, inventing no tier for the gap', () => {
    render(<InlaysConfigPanel />);
    expandZircon();

    expect(screen.getByText('Tier 1')).toBeDefined();
    expect(screen.getByText('Tier 9')).toBeDefined();
    // The sheet's Zircon has no tenth row, and neither has this — a gap, not a zero
    expect(screen.queryByText('Tier 10')).toBeNull();
    expect(screen.getByText('DEX: +9')).toBeDefined();
  });

  it('should add a family through the store', async () => {
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Inlay' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Diamond' } });
    fireEvent.change(screen.getByLabelText(/^Group/), { target: { value: 'Precious Gems' } });
    const submit = screen
      .getAllByRole('button', { name: 'Add Inlay' })
      .find((button) => (button as HTMLButtonElement).type === 'submit');
    fireEvent.click(submit as HTMLElement);

    await waitFor(() => {
      expect(storedInlays()).toHaveLength(2);
    });
    expect(storedInlays()[1].name).toBe('Diamond');
    expect(storedInlays()[1].group).toBe('Precious Gems');
    expect(storedInlays()[1].tiers).toEqual([]);
  });

  it('should edit a family without disturbing its ladder', async () => {
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Zirconium' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Inlay' }));

    await waitFor(() => {
      expect(storedInlays()[0].name).toBe('Zirconium');
    });
    expect(storedInlays()[0].tiers).toEqual(zircon.tiers);
  });

  it('should offer the next rung above the highest, not the count of rows', async () => {
    // `tiers.length + 1` would offer 3 to a family whose rungs are 1 and 9
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Tier' }));

    await waitFor(() => {
      expect((screen.getByLabelText(/^Tier/) as HTMLInputElement).value).toBe('10');
    });
  });

  it('should add a tier with a grant through the store', async () => {
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Tier' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Grant' }));
    fireEvent.change(screen.getByLabelText('Stat for grant row 1'), {
      target: { value: 'str-id' },
    });
    fireEvent.change(screen.getByLabelText('Modifier for row 1'), { target: { value: '12' } });
    // The dialog's submit, not the card's open-the-dialog button of the same name
    const submitTier = screen
      .getAllByRole('button', { name: 'Add Tier' })
      .find((button) => (button as HTMLButtonElement).type === 'submit');
    fireEvent.click(submitTier as HTMLElement);

    await waitFor(() => {
      expect(storedInlays()[0].tiers).toHaveLength(3);
    });
    expect(storedInlays()[0].tiers[2]).toEqual({
      tier: 10,
      bonuses: [{ statId: 'str-id', modifier: 12 }],
    });
  });

  it('should refuse a rung another row already claims, rather than writing a ladder import rejects', async () => {
    // `inlayTierShapeErrors` refuses two rows on one rung, so the panel has to as well — otherwise
    // the app writes a ruleset its own importer would turn away, and INV-05's socket would read
    // whichever row came first
    render(<InlaysConfigPanel />);
    expandZircon();

    fireEvent.click(screen.getByRole('button', { name: 'Edit tier 9 of Zircon' }));
    fireEvent.change(screen.getByLabelText(/^Tier/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tier' }));

    await waitFor(() => {
      expect(screen.getByText('Zircon already has a tier 1')).toBeDefined();
    });
    expect(storedInlays()[0].tiers).toEqual(zircon.tiers);
  });

  it('should let a tier keep its own rung while something else about it changes', async () => {
    // The collision check excludes the row being edited; without that, editing tier 9 at all would
    // report tier 9 as taken by itself
    render(<InlaysConfigPanel />);
    expandZircon();

    fireEvent.click(screen.getByRole('button', { name: 'Edit tier 9 of Zircon' }));
    fireEvent.change(screen.getByLabelText('Modifier for row 1'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Tier' }));

    await waitFor(() => {
      expect(storedInlays()[0].tiers[1].bonuses).toEqual([{ statId: 'dex-id', modifier: 11 }]);
    });
    expect(storedInlays()[0].tiers[1].tier).toBe(9);
  });

  it('should refuse a fractional rung, which the shape gate also refuses', async () => {
    // **Submitted through the form rather than through the button**, deliberately: a
    // `type="number"` input has an implicit `step` of 1, so a *click* on the submit button is
    // blocked by the browser's own constraint validation and never reaches react-hook-form — which
    // means clicking asserts the browser's rule and not ours. Dispatching `submit` bypasses that
    // gate and exercises the rule this ticket added, the one that also holds for any path native
    // validation does not cover.
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Tier' }));
    const rung = screen.getByLabelText(/^Tier/);
    fireEvent.change(rung, { target: { value: '2.5' } });
    const form = rung.closest('form');
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Tier must be a whole number')).toBeDefined();
    });
    expect(storedInlays()[0].tiers).toEqual(zircon.tiers);
  });

  it('should draw the ladder in rung order however it was added to', async () => {
    // Stored in insertion order — appending 5 to a [1, 9] family puts it last — so the card sorts
    const grown = [...zircon.tiers, { tier: 5, bonuses: [{ statId: 'dex-id', modifier: 5 }] }];
    act(() => {
      useConfigStore.setState({
        config: createConfig({ inlays: [{ ...zircon, tiers: grown }] }),
        isLoaded: true,
      });
    });

    render(<InlaysConfigPanel />);
    expandZircon();

    const drawn = screen.getAllByText(/^Tier \d+$/).map((node) => node.textContent);
    expect(drawn).toEqual(['Tier 1', 'Tier 5', 'Tier 9']);
    // …and the delete button still addresses the row it names, not the position it is drawn at
    fireEvent.click(screen.getByRole('button', { name: 'Delete tier 5 of Zircon' }));

    await waitFor(() => {
      expect(storedInlays()[0].tiers.map((tier) => tier.tier)).toEqual([1, 9]);
    });
  });

  it('should remove a tier without renumbering the ones left', async () => {
    render(<InlaysConfigPanel />);
    expandZircon();

    fireEvent.click(screen.getByRole('button', { name: 'Delete tier 1 of Zircon' }));

    await waitFor(() => {
      expect(storedInlays()[0].tiers.map((tier) => tier.tier)).toEqual([9]);
    });
  });

  it('should delete a family, since nothing can point at one yet', async () => {
    render(<InlaysConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(storedInlays()).toEqual([]);
    });
  });

  it('should say what is missing when no stat can take a grant', () => {
    act(() => {
      useConfigStore.setState({
        config: createConfig({
          stats: [stat({ id: 'apt-id', name: 'Actions', abbreviation: 'APT', formula: 'DEX / 2' })],
        }),
        isLoaded: true,
      });
    });

    render(<InlaysConfigPanel />);

    expect(screen.getByText(/No stats a grant can land on/)).toBeDefined();
  });

  it('should show the empty state for a ruleset with no inlays at all', () => {
    act(() => {
      useConfigStore.setState({ config: createConfig({ inlays: undefined }), isLoaded: true });
    });

    render(<InlaysConfigPanel />);

    expect(screen.getByText(/No inlays configured yet/)).toBeDefined();
  });
});
