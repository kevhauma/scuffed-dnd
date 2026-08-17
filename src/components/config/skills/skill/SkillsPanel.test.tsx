/**
 * Skills Configuration Panel Tests
 *
 * The store is real with storage mocked, so what the cards show is what the ruleset actually holds.
 * Weight rows are exercised through the dialog rather than through the hook (TICKET-SKL-03): the
 * add/remove buttons and the two boxes are the surface a User has, and a row that cannot be added
 * by clicking is a row that does not exist however well the manager handles it.
 *
 * **Validates: Concept 02; Requirements 21.1-21.5**
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { SkillsPanel } from './SkillsPanel';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 8,
  stats: [
    {
      id: 'stat-str',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'stat-dex',
      name: 'Dexterity',
      abbreviation: 'DEX',
      description: '',
      order: 1,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
  ],
  skills: [
    {
      id: 'skill-smithing',
      name: 'Black smithing',
      description: 'Working metal',
      statWeights: [{ statId: 'stat-str', weight: 0.2 }],
    },
  ],
  combatSkills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function storedSkills() {
  return useConfigStore.getState().config?.skills ?? [];
}

/** The dialog's weight rows: each is a stat picker paired with a number box */
function weightRows() {
  const dialog = screen.getByRole('dialog');
  return {
    pickers: within(dialog).getAllByRole('combobox'),
    weights: within(dialog).getAllByPlaceholderText('Weight'),
  };
}

/**
 * Submit the dialog
 *
 * Dispatched on the `<form>` rather than by clicking the submit button. jsdom only translates a
 * click into a submit event once React has committed the pending render, so a click landing
 * straight after a `fireEvent.change` on a controlled field is silently swallowed — the dialog
 * stays open and the assertion fails for a reason that has nothing to do with the code under test.
 * This is the same `onSubmit={onSave}` path a real click takes; that the button is wired to reach
 * it is asserted separately below.
 */
function save() {
  const form = screen.getByRole('dialog').querySelector('form');
  if (!form) throw new Error('The skill dialog rendered no form to submit');
  fireEvent.submit(form);
}

describe('SkillsPanel', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should show each skill’s weight rows as stat and weight, not as a formula', () => {
    render(<SkillsPanel />);

    expect(screen.getByText('Black smithing')).toBeTruthy();
    expect(screen.getByText('STR × 0.2')).toBeTruthy();
  });

  it('should wire the dialog’s confirm button to submit rather than to a handler', () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Update Skill',
    });

    // The one part of the button `save()` cannot exercise for itself: that reaching `onSave` is the
    // form's job, so keyboard Enter in any field saves the way the button does
    expect(confirm.getAttribute('type')).toBe('submit');
    expect(confirm.closest('form')).not.toBeNull();
  });

  it('should add a weight row to an existing skill and store it', async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(weightRows().pickers).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    await waitFor(() => expect(weightRows().pickers).toHaveLength(2));

    fireEvent.change(weightRows().pickers[1], { target: { value: 'stat-dex' } });
    fireEvent.change(weightRows().weights[1], { target: { value: '0.1' } });
    save();

    await waitFor(() =>
      expect(storedSkills()[0].statWeights).toEqual([
        { statId: 'stat-str', weight: 0.2 },
        { statId: 'stat-dex', weight: 0.1 },
      ])
    );
  });

  it('should remove a weight row and store the skill without it', async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    save();

    await waitFor(() => expect(storedSkills()[0].statWeights).toEqual([]));
  });

  it('should change a weight row’s stat and weight', async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(weightRows().pickers[0], { target: { value: 'stat-dex' } });
    fireEvent.change(weightRows().weights[0], { target: { value: '0.3' } });
    save();

    await waitFor(() =>
      expect(storedSkills()[0].statWeights).toEqual([{ statId: 'stat-dex', weight: 0.3 }])
    );
  });

  it('should create a new skill with a weight row from the Add flow', async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }));
    fireEvent.change(screen.getByPlaceholderText('Lock picking'), {
      target: { value: 'Hiding' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Stat' }));
    await waitFor(() => expect(weightRows().pickers).toHaveLength(1));

    fireEvent.change(weightRows().pickers[0], { target: { value: 'stat-dex' } });
    fireEvent.change(weightRows().weights[0], { target: { value: '0.3' } });
    save();

    await waitFor(() => expect(storedSkills()).toHaveLength(2));
    expect(storedSkills().at(-1)).toMatchObject({
      name: 'Hiding',
      statWeights: [{ statId: 'stat-dex', weight: 0.3 }],
    });
  });

  it('should refuse a skill with no name and leave the ruleset untouched', async () => {
    render(<SkillsPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }));
    save();

    await waitFor(() => expect(screen.getByText('Name is required')).toBeTruthy());
    expect(storedSkills()).toHaveLength(1);
  });

  it('should say what a skill with no weight rows is worth rather than showing nothing', () => {
    useConfigStore.setState({
      config: { ...structuredClone(config), skills: [{ ...config.skills[0], statWeights: [] }] },
      isLoaded: true,
    });
    render(<SkillsPanel />);

    expect(screen.getByText(/worth whatever the Player invests/)).toBeTruthy();
  });
});
