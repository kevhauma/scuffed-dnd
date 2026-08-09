/**
 * Combat Roller Tests
 *
 * Two levels: the hook is driven directly with a deterministic `RandomSource` so exact numbers can
 * be asserted, and the sheet is rendered whole so the button, breakdown and history are checked
 * where a Player meets them.
 *
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 5.5, 5.6**
 */

import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatedCharacter, Character } from '../../../types/character';
import type { Configuration } from '../../../types/config';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { calculateCharacter } from '../../../engine/calculator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import { CharacterSheet } from '../sheet/CharacterSheet';
import { useCombatRoller } from './useCombatRoller';

function createConfig(overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 2,
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
    specialitySkills: [],
    combatSkills: [
      {
        id: 'MEL',
        code: 'MEL',
        name: 'Melee',
        description: '',
        dice: { d4: 0, d6: 2, d8: 0, d10: 0, d12: 0, d20: 0 },
        bonusFormula: 'STR',
      },
      {
        id: 'RNG',
        code: 'RNG',
        name: 'Ranged',
        description: '',
        dice: { d4: 0, d6: 0, d8: 0, d10: 0, d12: 0, d20: 1 },
        bonusFormula: 'STR * 2',
      },
    ],
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

function createCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: { STR: 5 },
    specialitySkillBaseLevels: {},
    currentResourceValues: { health: 50 },
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

/** A deterministic stand-in for Math.random, cycling through the given values */
function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

function calculatedFor(config: Configuration, character: Character): CalculatedCharacter {
  return calculateCharacter(character, config);
}

describe('useCombatRoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useUIStore.setState({ rollHistory: [] });
  });

  it('should roll every configured die and add the engine bonus', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    // 0.0 → 1 and 0.99 → 6 on a d6, so two d6 give 1 + 6 = 7, plus the STR bonus of 5
    const { result } = renderHook(() =>
      useCombatRoller('char1', calculated, { rng: sequenceRng([0, 0.99]) })
    );

    act(() => result.current.handleRoll('MEL'));

    const roll = result.current.results.MEL;
    expect(roll.diceResults).toEqual([{ dieType: 'd6', rolls: [1, 6], total: 7 }]);
    expect(roll.diceTotal).toBe(7);
    expect(roll.bonus).toBe(5);
    expect(roll.total).toBe(12);
  });

  it('should take its bonus from the same calculator the sheet displays', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    const { result } = renderHook(() =>
      useCombatRoller('char1', calculated, { rng: sequenceRng([0.5]) })
    );

    act(() => result.current.handleRoll('RNG'));

    // Requirement 15.3 — the roll's bonus is the engine's, not a second evaluation
    expect(result.current.results.RNG.bonus).toBe(calculated.combatSkillBonuses.RNG);
  });

  it('should record every roll in the session history, newest first', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    const { result } = renderHook(() =>
      useCombatRoller('char1', calculated, { rng: sequenceRng([0.5]) })
    );

    act(() => result.current.handleRoll('MEL'));
    act(() => result.current.handleRoll('RNG'));

    // Requirement 15.5
    expect(result.current.history.map((roll) => roll.skillCode)).toEqual(['RNG', 'MEL']);
    expect(result.current.history[0].characterId).toBe('char1');
    expect(result.current.history[0].characterName).toBe('Aria');
  });

  it('should show only the current character rolls', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    const { result: aria } = renderHook(() =>
      useCombatRoller('char1', calculated, { rng: sequenceRng([0.5]) })
    );
    act(() => aria.current.handleRoll('MEL'));

    const { result: other } = renderHook(() => useCombatRoller('char2', calculated));

    expect(aria.current.history).toHaveLength(1);
    expect(other.current.history).toHaveLength(0);
  });

  it('should clear the history through the store action', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    const { result } = renderHook(() =>
      useCombatRoller('char1', calculated, { rng: sequenceRng([0.5]) })
    );

    act(() => result.current.handleRoll('MEL'));
    act(() => result.current.handleClearHistory());

    expect(result.current.history).toHaveLength(0);
    expect(useUIStore.getState().rollHistory).toHaveLength(0);
  });

  it('should report a bonus formula that does not evaluate instead of throwing', () => {
    const config = createConfig();
    const calculated = calculatedFor(config, createCharacter());

    // The character was calculated against a working ruleset; the loaded one is broken
    useConfigStore.setState({
      config: createConfig({
        combatSkills: [
          {
            id: 'MEL',
            code: 'MEL',
            name: 'Melee',
            description: '',
            dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
            bonusFormula: 'NOPE',
          },
        ],
      }),
      isLoaded: true,
    });

    const { result } = renderHook(() => useCombatRoller('char1', calculated));

    act(() => result.current.handleRoll('MEL'));

    expect(result.current.errors.MEL).toMatch(/Melee/);
    expect(result.current.results.MEL).toBeUndefined();
    expect(useUIStore.getState().rollHistory).toHaveLength(0);
  });

  it('should refuse to roll without a calculated character', () => {
    const { result } = renderHook(() => useCombatRoller('char1', null));

    expect(result.current.canRoll).toBe(false);

    act(() => result.current.handleRoll('MEL'));

    expect(useUIStore.getState().rollHistory).toHaveLength(0);
  });
});

describe('rolling from the character sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [createCharacter()], isLoaded: true });
    useUIStore.setState({ rollHistory: [] });
  });

  it('should offer a roll control for every combat skill', () => {
    render(<CharacterSheet characterId="char1" />);

    // Requirement 15.1
    expect(screen.getByRole('button', { name: 'Roll MEL' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Roll RNG' })).toBeDefined();
  });

  it('should show the dice, bonus and total of the last roll', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll MEL' }));

    // Requirement 15.4 — with real randomness the numbers vary, so assert the invariant
    const breakdown = screen.getByText(/^d6: /).parentElement as HTMLElement;
    const dice = Number(
      within(breakdown)
        .getByText(/^dice /)
        .textContent?.replace('dice ', '')
    );
    const bonus = Number(
      within(breakdown)
        .getByText(/^bonus /)
        .textContent?.replace('bonus ', '')
    );

    expect(bonus).toBe(5);
    expect(dice).toBeGreaterThanOrEqual(2);
    expect(dice).toBeLessThanOrEqual(12);
    expect(within(breakdown).getByText(String(dice + bonus))).toBeDefined();
  });

  it('should roll the bonus the sheet displays for that skill', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll RNG' }));

    // The Ranged row shows +10 (STR 5 * 2) and the roll must agree. The name also appears in the
    // history panel below, so take the first — the combat section renders ahead of it.
    const row = screen.getAllByText(/Ranged \(RNG\)/)[0].closest('div.border-b') as HTMLElement;
    expect(within(row).getByText('+10')).toBeDefined();
    expect(within(row).getByText('bonus +10')).toBeDefined();
  });

  it('should grow the roll history and clear it again', () => {
    render(<CharacterSheet characterId="char1" />);

    expect(screen.getByText(/No rolls this session/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Roll MEL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Roll RNG' }));

    const history = screen.getByRole('heading', { name: 'Roll History' }).parentElement
      ?.parentElement as HTMLElement;
    // Requirement 15.5 — newest first
    expect(
      within(history)
        .getAllByText(/\((MEL|RNG)\)/)
        .map((node) => node.textContent)
    ).toEqual(['Ranged (RNG)', 'Melee (MEL)']);

    fireEvent.click(screen.getByRole('button', { name: 'Clear History' }));
    expect(screen.getByText(/No rolls this session/)).toBeDefined();
  });

  it('should keep roll history out of storage and off the character', () => {
    render(<CharacterSheet characterId="char1" />);

    fireEvent.click(screen.getByRole('button', { name: 'Roll MEL' }));

    expect(useUIStore.getState().rollHistory).toHaveLength(1);
    expect(JSON.stringify(useCharacterStore.getState().characters[0])).not.toMatch(/skillCode/);
  });
});
