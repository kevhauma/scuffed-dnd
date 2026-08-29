/**
 * Roller Hook Tests
 *
 * The successor to `CombatRoller.test.tsx`, which went with `useCombatRoller`. The stores are real
 * with storage mocked, so a roll really lands in `useUIStore`'s session history.
 *
 * What is asserted is the hook's own job — keep the latest result per roll, report a broken input
 * beside that roll rather than fatally, and record every successful roll in history. The dice
 * themselves are `rollRollDefinition`'s tests; randomness is injected, never spied on.
 *
 * **Validates: Concept 08; Requirements 15.1, 15.2, 15.3, 15.5**
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalculatedCharacter } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { FormulaResult } from '#shared/types/formula';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { formulaError } from '#shared/engine/formula/errors';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import { useRoller } from './useRoller';

function createConfig(): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 9,
    stats: [],
    skills: [],
    diceLadders: [
      {
        id: 'ladder',
        name: 'Standard',
        description: '',
        dieSizes: [20, 12, 6],
        showZeroTerms: true,
        remainder: 'flat',
      },
    ],
    rollDefinitions: [
      {
        id: 'mel-id',
        name: 'Melee',
        description: '',
        input: 'STR',
        ladderId: 'ladder',
        order: 0,
      },
    ],
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

function createCalculated(rollInputs: Record<string, FormulaResult>): CalculatedCharacter {
  return {
    id: 'char1',
    name: 'Aria',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints: {},
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    statValues: {},
    statTotal: 0,
    skillLevels: {},
    skillBonuses: {},
    skillContributions: {},
    skillFocus: {},
    rollInputs,
    equipmentBonuses: [],
  };
}

/** The hook, wired to a character whose Melee input is `input` */
function renderRoller(input: FormulaResult = 39) {
  return renderHook(() =>
    useRoller('char1', createCalculated({ 'mel-id': input }), { rng: () => 0 })
  );
}

describe('useRoller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: createConfig(), isLoaded: true });
    useUIStore.setState({ rollHistory: [] });
  });

  it('should keep the latest result per roll id', () => {
    const { result } = renderRoller();

    act(() => result.current.handleRoll('mel-id'));

    // Every die at its minimum, plus the flat: 1 + 1 + 1 + 1
    expect(result.current.results['mel-id'].total).toBe(4);
    expect(result.current.results['mel-id'].notation).toBe('1D20 + 1D12 + 1D6 + 1');
  });

  it('should record the roll in the session history, tagged with who rolled it', () => {
    const { result } = renderRoller();

    act(() => result.current.handleRoll('mel-id'));

    const [entry] = useUIStore.getState().rollHistory;
    expect(entry.characterId).toBe('char1');
    expect(entry.characterName).toBe('Aria');
    expect(entry.rollName).toBe('Melee');
    expect(result.current.history).toHaveLength(1);
  });

  it('should report a broken input beside that roll, with no result and no history entry', () => {
    const { result } = renderRoller(formulaError('undefined-variable', 'Undefined variable: STR'));

    act(() => result.current.handleRoll('mel-id'));

    expect(result.current.errors['mel-id']).toContain('Undefined variable: STR');
    expect(result.current.results['mel-id']).toBeUndefined();
    expect(useUIStore.getState().rollHistory).toHaveLength(0);
  });

  it('should ignore a roll id the ruleset does not define', () => {
    const { result } = renderRoller();

    act(() => result.current.handleRoll('nope'));

    expect(result.current.results).toEqual({});
    expect(result.current.errors).toEqual({});
  });

  it('should show each character only their own rolls', () => {
    const mine = renderRoller();
    act(() => mine.result.current.handleRoll('mel-id'));

    const theirs = renderHook(() =>
      useRoller('char2', createCalculated({ 'mel-id': 39 }), { rng: () => 0 })
    );

    expect(mine.result.current.history).toHaveLength(1);
    expect(theirs.result.current.history).toHaveLength(0);
    // …though the store holds the one entry either way — the filter is the hook's
    expect(useUIStore.getState().rollHistory).toHaveLength(1);
  });

  it('should clear a standing error once that roll succeeds', () => {
    const broken = formulaError('undefined-variable', 'Undefined variable: STR');
    const { result, rerender } = renderHook(
      ({ input }: { input: FormulaResult }) =>
        useRoller('char1', createCalculated({ 'mel-id': input }), { rng: () => 0 }),
      { initialProps: { input: broken as FormulaResult } }
    );

    act(() => result.current.handleRoll('mel-id'));
    expect(result.current.errors['mel-id']).toBeDefined();

    // The ruleset is fixed and the Player rolls again
    rerender({ input: 39 });
    act(() => result.current.handleRoll('mel-id'));

    expect(result.current.errors['mel-id']).toBeUndefined();
    expect(result.current.results['mel-id'].total).toBe(4);
  });

  it("should clear this character's history on request", () => {
    const { result } = renderRoller();
    act(() => result.current.handleRoll('mel-id'));

    act(() => result.current.handleClearHistory());

    expect(useUIStore.getState().rollHistory).toEqual([]);
  });

  it("should leave other characters' rolls alone when clearing (CR-06)", () => {
    // The panel shows one character's rolls; the button used to empty the whole session
    useUIStore.setState({
      rollHistory: [
        {
          id: 'theirs',
          characterId: 'char2',
          characterName: 'Bree',
          rollId: 'mel-id',
          rollName: 'Melee',
          input: 10,
          dice: [],
          diceTotal: 0,
          flat: 10,
          total: 10,
          notation: '10',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ],
    });

    const { result } = renderRoller();
    act(() => result.current.handleRoll('mel-id'));
    expect(useUIStore.getState().rollHistory).toHaveLength(2);

    act(() => result.current.handleClearHistory());

    expect(useUIStore.getState().rollHistory.map((roll) => roll.id)).toEqual(['theirs']);
    expect(result.current.history).toEqual([]);
  });

  it('should refuse to roll at all without a calculated character', () => {
    const { result } = renderHook(() => useRoller('char1', null));

    expect(result.current.canRoll).toBe(false);
    act(() => result.current.handleRoll('mel-id'));
    expect(result.current.results).toEqual({});
  });
});
