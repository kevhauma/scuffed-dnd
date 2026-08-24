/**
 * Stat Manager Hook Tests
 *
 * Covers the save-time formula guard: a stat whose formula would not compute is refused
 * (Requirements 16.5, 16.6) and never reaches the store.
 *
 * **Validates: Requirements 2.3, 16.5, 16.6**
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

import { useConfigStore } from '../../../stores/configStore';
import { useStatManager } from './useStatManager';

const config: Configuration = {
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
      id: 'CON',
      name: 'Constitution',
      abbreviation: 'CON',
      description: '',
      order: 1,
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

/**
 * `formState` is a proxy: reading `errors` inside the render subscribes to it, without which
 * the hook never re-renders on `setError` and the snapshot stays stale.
 */
function renderStatManager() {
  return renderHook(() => {
    const manager = useStatManager();
    void manager.form.formState.errors;
    return manager;
  });
}

async function submit(
  result: { current: ReturnType<typeof useStatManager> },
  values: { name: string; formula: string; abbreviation?: string }
) {
  await act(async () => {
    result.current.form.setValue('name', values.name);
    // An abbreviation is a formula spelling now, so every save needs one (TICKET-STAT-01)
    result.current.form.setValue(
      'abbreviation',
      values.abbreviation ?? values.name.slice(0, 3).toUpperCase()
    );
    result.current.form.setValue('description', '');
    result.current.form.setValue('formula', values.formula);
  });
  await act(async () => {
    await result.current.handleSave();
  });
}

describe('useStatManager', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should refuse a formula referencing an undefined skill code and name the code', async () => {
    const { result } = renderStatManager();

    await submit(result, { name: 'Mana', formula: 'WIS * 5' });

    expect(result.current.form.formState.errors.formula?.message).toContain('WIS');
    expect(useConfigStore.getState().config?.stats.filter((stat) => stat.formula)).toHaveLength(1);
    expect(result.current.isDialogOpen).toBe(false); // dialog was never opened in this test
  });

  it('should save a valid multi-reference formula', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleAdd());
    await submit(result, { name: 'Vitality', formula: 'STR * 2 + CON' });

    const stats = useConfigStore.getState().config?.stats ?? [];
    expect(stats.filter((stat) => stat.formula)).toHaveLength(2);
    expect(stats.at(-1)).toMatchObject({ name: 'Vitality', formula: 'STR * 2 + CON' });
    expect(result.current.form.formState.errors.formula).toBeUndefined();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('should keep the dialog open and leave the stat untouched when the save is refused', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleEdit('health'));
    expect(result.current.isDialogOpen).toBe(true);

    await submit(result, { name: 'Health', formula: 'STR * WIS' });

    expect(result.current.isDialogOpen).toBe(true);
    expect(
      useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
    ).toBe('STR * 10');
  });

  it('should refuse an unparseable formula', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleAdd());
    await submit(result, { name: 'Broken', formula: 'STR * * 2' });

    expect(result.current.form.formState.errors.formula).toBeDefined();
    expect(useConfigStore.getState().config?.stats.filter((stat) => stat.formula)).toHaveLength(1);
  });

  describe('ordering (TICKET-STAT-02)', () => {
    it('should list the stats by their order rather than by array position', () => {
      // Written out of order on purpose: an imported ruleset can hold either arrangement
      useConfigStore.setState({
        config: {
          ...structuredClone(config),
          stats: [
            { ...config.stats[0], id: 'a', order: 2 },
            { ...config.stats[1], id: 'b', order: 0 },
            { ...config.stats[2], id: 'c', order: 1 },
          ],
        },
        isLoaded: true,
      });

      const { result } = renderStatManager();

      expect(result.current.currentStats.map((stat) => stat.id)).toEqual(['b', 'c', 'a']);
    });

    it('should do nothing when a move would run off the end', () => {
      const { result } = renderStatManager();
      const before = result.current.currentStats.map((stat) => stat.id);

      act(() => result.current.handleMove(before[0], -1));
      act(() => result.current.handleMove(before.at(-1) as string, 1));

      // A no-op rather than a wrap — the list has ends, and they hold
      expect(result.current.currentStats.map((stat) => stat.id)).toEqual(before);
    });

    it('should ignore a move for a stat that is not there', () => {
      const { result } = renderStatManager();
      const before = result.current.currentStats.map((stat) => stat.id);

      act(() => result.current.handleMove('not-a-stat', 1));

      expect(result.current.currentStats.map((stat) => stat.id)).toEqual(before);
    });
  });

  describe('the derived/invested distinction and the resource warning', () => {
    it('should call a stat derived exactly while its formula field holds something', () => {
      const { result } = renderStatManager();

      act(() => result.current.handleAdd());
      expect(result.current.isDerived).toBe(false);

      act(() => result.current.form.setValue('formula', 'STR * 2'));
      expect(result.current.isDerived).toBe(true);

      // Whitespace is not a formula — clearing the field puts the stat back on points
      act(() => result.current.form.setValue('formula', '   '));
      expect(result.current.isDerived).toBe(false);
    });

    it('should warn about a resource with neither a formula nor a maximum', () => {
      const { result } = renderStatManager();

      act(() => result.current.handleAdd());
      expect(result.current.warnings).toEqual([]);

      act(() => result.current.form.setValue('isResource', true));
      expect(result.current.warnings[0]).toContain('no ceiling');

      // A formula derives the maximum, so there is a ceiling after all
      act(() => result.current.form.setValue('formula', 'STR * 10'));
      expect(result.current.warnings).toEqual([]);
    });

    it('should take a typed maximum as the ceiling', () => {
      const { result } = renderStatManager();

      act(() => result.current.handleAdd());
      act(() => result.current.form.setValue('isResource', true));
      act(() => result.current.form.setValue('max', '50'));

      expect(result.current.warnings).toEqual([]);
    });
  });
});
