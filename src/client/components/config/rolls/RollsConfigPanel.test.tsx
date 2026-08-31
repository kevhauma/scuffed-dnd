/**
 * Rolls and Dice Ladders Configuration Panel Tests
 *
 * Both panels in one file because they share a fixture and are mounted together at `/config/rolls`.
 * The store is real with storage mocked, so what a panel shows is what the ruleset actually holds
 * and a save really goes through `addRollDefinition` / `updateDiceLadder`.
 *
 * What is asserted through the DOM is TICKET-ROLL-05's point: a roll is an **input expression plus
 * a ladder** and nothing else — no dice-count boxes — and a ladder a roll still names cannot be
 * deleted.
 *
 * **Validates: Concepts 07, 08; Requirements 16.4, 21.1-21.5**
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FORMULA_OWNER, scopeFor } from '#shared/engine/formula/scoping';
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
import { DiceLaddersConfigPanel } from './DiceLaddersConfigPanel';
import { RollsConfigPanel } from './RollsConfigPanel';

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
    schemaVersion: 10,
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
    diceLadders: [
      {
        id: 'ladder-standard',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'roll-melee',
        name: 'Melee',
        description: 'Swing something heavy',
        input: 'stats.strength',
        ladderId: 'ladder-standard',
        category: 'offence',
        order: 0,
      },
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

const storedRolls = () => useConfigStore.getState().config?.rollDefinitions ?? [];
const storedLadders = () => useConfigStore.getState().config?.diceLadders ?? [];

/** Each panel renders one card, so its Edit and Delete are unambiguous within that render */
const clickEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
const clickDelete = () => fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

/**
 * The roll's input box
 *
 * By label since CR-13's accessibility pass: `FormulaEditor` mints its own id and points its label
 * at it, so a formula field is reachable the same way every other field is. This used to be found
 * by placeholder because there was no association to query.
 */
const inputBox = () => screen.getByLabelText('Input');

describe('RollsConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should show a roll as its input and its ladder', () => {
    render(<RollsConfigPanel />);

    expect(screen.getByText('Melee')).toBeDefined();
    expect(screen.getByText('stats.strength')).toBeDefined();
    expect(screen.getByText('Standard — 20 | 12 | 6')).toBeDefined();
  });

  it('should say so when a roll points at a ladder that is gone', () => {
    useConfigStore.setState({
      config: createConfig({ diceLadders: [] }),
      isLoaded: true,
    });

    render(<RollsConfigPanel />);

    expect(screen.getByText('No such ladder')).toBeDefined();
  });

  it('should offer no dice-count boxes — a roll derives its pool', () => {
    render(<RollsConfigPanel />);
    clickEdit();

    // The six `DiceConfig` fields the combat-skill dialog has, which this entity exists to replace
    for (const die of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']) {
      expect(screen.queryByLabelText(die)).toBeNull();
    }
    expect(inputBox()).toBeDefined();
  });

  it('should save an edited input through the store', async () => {
    render(<RollsConfigPanel />);
    clickEdit();

    fireEvent.change(inputBox(), { target: { value: 'stats.strength + 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Roll' }));

    await waitFor(() => {
      expect(storedRolls()[0].input).toBe('stats.strength + 2');
    });
  });

  it('should refuse an input that would not compute, without saving', async () => {
    render(<RollsConfigPanel />);
    clickEdit();

    fireEvent.change(inputBox(), { target: { value: 'stats.nonesuch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Roll' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Unknown member/i).length).toBeGreaterThan(0);
    });
    expect(storedRolls()[0].input).toBe('stats.strength');
  });

  it('should offer exactly the codes the roll-input scope grants (CR-25)', () => {
    render(<RollsConfigPanel />);
    clickEdit();

    fireEvent.change(inputBox(), { target: { value: 'ST' } });

    // Whatever `scoping.ts` says a roll input may name is what the editor completes — the list is
    // read from `scopeFor`, not mapped from `config.stats` beside it
    const granted = Array.from(scopeFor(createConfig(), FORMULA_OWNER.ROLL_INPUT).codes).filter(
      (code) => code.startsWith('ST')
    );
    expect(granted).toEqual(['STR']);
    for (const code of granted) {
      expect(screen.getByRole('button', { name: code })).toBeDefined();
    }
    expect(screen.queryByRole('button', { name: 'DEX' })).toBeNull();
  });

  it('should prompt for a ladder rather than opening the picker blank', () => {
    useConfigStore.setState({
      config: createConfig({
        diceLadders: [
          {
            id: 'ladder-standard',
            name: 'Standard',
            description: '',
            dieSizes: [20, 12, 6],
            showZeroTerms: true,
            remainder: 'flat',
          },
          {
            id: 'ladder-high',
            name: 'High level',
            description: '',
            dieSizes: [100, 20],
            showZeroTerms: true,
            remainder: 'flat',
          },
        ],
      }),
      isLoaded: true,
    });

    render(<RollsConfigPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Roll' }));

    // With more than one ladder nothing is preselected, so the picker has to say what to do
    expect((screen.getByLabelText('Dice Ladder') as HTMLSelectElement).value).toBe('');
    expect(screen.getByText('Select a dice ladder')).toBeDefined();
  });

  it('should say a roll needs a ladder before offering to add one', () => {
    useConfigStore.setState({
      config: createConfig({ diceLadders: [], rollDefinitions: [] }),
      isLoaded: true,
    });

    render(<RollsConfigPanel />);

    expect(screen.getByRole('note').textContent).toContain('No dice ladders configured yet');
    expect((screen.getByRole('button', { name: 'Add Roll' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});

describe('DiceLaddersConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should show a ladder with a worked decomposition from the engine', () => {
    render(<DiceLaddersConfigPanel />);

    expect(screen.getByText('20 | 12 | 6')).toBeDefined();
    // Concept 07's headline row, computed rather than restated
    expect(screen.getByText('1D20 + 1D12 + 1D6 + 1')).toBeDefined();
  });

  it('should save a re-typed size list as numbers', async () => {
    render(<DiceLaddersConfigPanel />);
    clickEdit();

    fireEvent.change(screen.getByLabelText(/Die Sizes/), { target: { value: '100, 20, 12, 6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Ladder' }));

    await waitFor(() => {
      expect(storedLadders()[0].dieSizes).toEqual([100, 20, 12, 6]);
    });
  });

  it('should refuse a size list that is not strictly descending', async () => {
    render(<DiceLaddersConfigPanel />);
    clickEdit();

    fireEvent.change(screen.getByLabelText(/Die Sizes/), { target: { value: '6, 20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Ladder' }));

    await waitFor(() => {
      // Not `/largest first/` — the field's own help text says that too; this is the refusal
      expect(screen.getByText(/with no repeats/i)).toBeDefined();
    });
    expect(storedLadders()[0].dieSizes).toEqual([20, 12, 6]);
  });

  it('should remove the cap rather than store an empty one', async () => {
    useConfigStore.setState({
      config: createConfig({
        diceLadders: [
          {
            id: 'ladder-standard',
            name: 'Standard',
            description: '',
            dieSizes: [20, 12, 6],
            maxPerDie: 2,
            showZeroTerms: true,
            remainder: 'flat',
          },
        ],
      }),
      isLoaded: true,
    });

    render(<DiceLaddersConfigPanel />);
    clickEdit();

    fireEvent.change(screen.getByLabelText(/Max Per Die/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Ladder' }));

    await waitFor(() => {
      expect(storedLadders()[0]).not.toHaveProperty('maxPerDie');
    });
  });

  it('should say there is no configuration rather than offer an Add that no-ops (CR-16)', () => {
    useConfigStore.setState({ config: null, isLoaded: true });

    render(<DiceLaddersConfigPanel />);

    expect(screen.getByText(/No configuration loaded/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add Ladder' })).toBeNull();
  });

  it('should refuse to delete a ladder a roll still names, listing the roll', async () => {
    render(<DiceLaddersConfigPanel />);

    clickDelete();

    await waitFor(() => {
      expect(screen.getByText(/cannot be deleted/)).toBeDefined();
    });
    expect(screen.getByRole('list').textContent).toContain('Melee');
    expect(storedLadders()).toHaveLength(1);
  });
});
