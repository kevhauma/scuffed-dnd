/**
 * Character Creation Hook Tests
 *
 * What the wizard's own test file cannot assert through the DOM: **how often** the engine runs.
 * CR-14 found an unmasked `form.watch()` feeding an unmemoised `calculateCharacter` and
 * `validateStatAllocation`, so typing the character's name on step 0 re-evaluated every stat
 * formula, curve lookup and skill in the ruleset per keystroke.
 *
 * The counters here are the regression guard: the engine runs when a *choice* changes, and not
 * when a field nothing derives from does.
 *
 * **Validates: Concept 03; Requirements 11.1, 11.3**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Configuration } from '#shared/types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// The real engine, counted. Spying rather than stubbing keeps every value the hook produces
// genuine — this file asserts the call count, not the arithmetic.
vi.mock('#shared/engine/calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#shared/engine/calculator')>();
  return { ...actual, calculateCharacter: vi.fn(actual.calculateCharacter) };
});

import { calculateCharacter } from '#shared/engine/calculator';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useCharacterCreation } from './useCharacterCreation';

function createConfig(): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
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
        order: 1,
        countsTowardTotal: true,
        isResource: false,
        rounding: 'none',
        formula: 'STR * 10',
      },
    ],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

const runs = () => vi.mocked(calculateCharacter).mock.calls.length;

describe('useCharacterCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useCharacterStore.setState({ characters: [], isLoaded: true });
  });

  it('should not re-run the engine while the name is typed (CR-14)', () => {
    const { result } = renderHook(() => useCharacterCreation());

    const before = runs();
    expect(before).toBeGreaterThan(0);

    for (const name of ['A', 'Ar', 'Ari', 'Aria']) {
      act(() => {
        result.current.form.setValue('name', name);
      });
    }

    // The name reaches the form — it is just not something any derived value depends on
    expect(result.current.values.name).toBe('Aria');
    expect(runs()).toBe(before);
  });

  it('should re-run the engine when a choice that changes a number does (CR-14)', () => {
    const { result } = renderHook(() => useCharacterCreation());

    const before = runs();

    act(() => {
      result.current.setInvestedStatPoints('STR', 3);
    });

    expect(runs()).toBeGreaterThan(before);
    // And the preview moved with it, which is the point of running it at all
    expect(result.current.preview?.statValues.health).toBe(30);
  });

  it('should not re-run the engine when a choice is re-made with the same value (CR-14)', () => {
    const { result } = renderHook(() => useCharacterCreation());

    act(() => {
      result.current.setInvestedStatPoints('STR', 3);
    });
    const after = runs();

    act(() => {
      result.current.setInvestedStatPoints('STR', 3);
    });

    // Keyed on content, because react-hook-form hands back a fresh object every render
    expect(runs()).toBe(after);
  });
});
