/**
 * Passives Configuration Panel Tests (TICKET-PAS-01)
 *
 * The store is real with storage mocked, so what the panel shows is what the ruleset actually holds
 * and a save really goes through `addPassive` / `updatePassive` / `deletePassive`.
 *
 * **The delete guard is the case that matters most**, and it is the one thing this panel has that
 * `SpellsConfigPanel` did not on the day it shipped: `Character.passiveIds` lands in the same
 * ticket as the catalog, so a passive somebody holds is refused from the first day rather than
 * after the next one. The rest is the four-part shape every config domain has.
 *
 * **Deliberately no search and no pager cases**, because there is no search and no pager: the
 * catalog is 26 rows and narrowing a list that fits on screen would be controls between a User and
 * a table they can already read.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '#shared/types/character';
import type { Configuration, Passive } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { PassivesConfigPanel } from './PassivesConfigPanel';

/** A plain row of the sheet's tab: a name and a sentence that computes nothing */
const charmImmunity: Passive = {
  id: 'passive-charmed',
  name: 'Charm immunity',
  effectText: 'You cannot be charmed.',
};

function createConfig(): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 10,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    passives: [charmImmunity],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  } as unknown as Configuration;
}

function aHolder(passiveIds: string[]): Character {
  return {
    id: 'char1',
    name: 'Quackers',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    passiveIds,
    inventory: { equippedItems: {}, composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  } as unknown as Character;
}

const storedPassives = () => useConfigStore.getState().config?.passives ?? [];

const loadRuleset = (overrides: Partial<Configuration> = {}) => {
  act(() => {
    useConfigStore.setState({ config: { ...createConfig(), ...overrides }, isLoaded: true });
  });
};

/** The dialog's submit, told apart from the header button of the same name by its `type` */
const submitDialog = (label: string) => {
  const submit = screen
    .getAllByRole('button', { name: label })
    .find((button) => (button as HTMLButtonElement).type === 'submit');
  fireEvent.click(submit as HTMLElement);
};

describe('PassivesConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should list a passive with its effect text', () => {
    render(<PassivesConfigPanel />);

    expect(screen.getByText('Charm immunity')).toBeDefined();
    expect(screen.getByText('You cannot be charmed.')).toBeDefined();
  });

  it('should draw the template as written rather than resolving it', () => {
    // This is the authoring list: what an author needs here is their own template, and resolving it
    // would mean inventing sample values for a character that is not on this page
    loadRuleset({
      passives: [{ ...charmImmunity, effectText: 'out to {skills.perception.level * 10} feet' }],
    });
    render(<PassivesConfigPanel />);

    expect(screen.getByText(/\{skills\.perception\.level \* 10\}/)).toBeDefined();
  });

  it('should say so for a passive nobody has written an effect for', () => {
    loadRuleset({ passives: [{ ...charmImmunity, effectText: '' }] });
    render(<PassivesConfigPanel />);

    expect(screen.getByText('No effect text.')).toBeDefined();
  });

  it('should offer an empty state when the ruleset names no passives', () => {
    loadRuleset({ passives: [] });
    render(<PassivesConfigPanel />);

    expect(screen.getByText(/No passive abilities configured yet/)).toBeDefined();
  });

  it('should add a passive through the store', async () => {
    loadRuleset({ passives: [] });
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Passive' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Blindsight' } });
    fireEvent.change(screen.getByLabelText('Effect'), {
      target: { value: 'You have blindsight.' },
    });
    submitDialog('Add Passive');

    await waitFor(() => {
      expect(storedPassives()).toHaveLength(1);
    });
    expect(storedPassives()[0].name).toBe('Blindsight');
    expect(storedPassives()[0].effectText).toBe('You have blindsight.');
  });

  it('should add one with no effect text, which is a row the sheet has', async () => {
    loadRuleset({ passives: [] });
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Passive' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'False appearance' } });
    submitDialog('Add Passive');

    await waitFor(() => {
      expect(storedPassives()).toHaveLength(1);
    });
    expect(storedPassives()[0].effectText).toBe('');
  });

  it('should edit a passive in place', async () => {
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Charm immunity' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Charm resistance' } });
    submitDialog('Update Passive');

    await waitFor(() => {
      expect(storedPassives()[0].name).toBe('Charm resistance');
    });
    expect(storedPassives()[0].id).toBe('passive-charmed');
  });

  it('should delete a passive nobody holds', () => {
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Charm immunity' }));

    expect(storedPassives()).toEqual([]);
  });

  it('should refuse to delete one a character holds, naming the holder', () => {
    // The guard is live from day one here, which is the difference from `spell` and `inlay`: the
    // catalog and the holder's list arrive in the same ticket
    act(() => {
      useCharacterStore.setState({ characters: [aHolder(['passive-charmed'])], isLoaded: true });
    });
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Charm immunity' }));

    expect(storedPassives()).toHaveLength(1);
    expect(screen.getByText(/Character: Quackers/)).toBeDefined();
    expect(screen.getByText(/passiveIds/)).toBeDefined();
  });

  it('should delete anyway when the User forces it through', () => {
    act(() => {
      useCharacterStore.setState({ characters: [aHolder(['passive-charmed'])], isLoaded: true });
    });
    render(<PassivesConfigPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Charm immunity' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete Anyway/i }));

    expect(storedPassives()).toEqual([]);
  });

  it('should show the notice instead of the panel when no ruleset is loaded', () => {
    act(() => {
      useConfigStore.setState({ config: null, isLoaded: true });
    });
    render(<PassivesConfigPanel />);

    expect(screen.queryByRole('button', { name: 'Add Passive' })).toBeNull();
  });
});
