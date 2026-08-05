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
import type { Configuration } from '../../../types/config';

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
  mainSkills: [
    { id: 'STR', code: 'STR', name: 'Strength', description: '', maxLevel: 20 },
    { id: 'CON', code: 'CON', name: 'Constitution', description: '', maxLevel: 20 },
  ],
  stats: [{ id: 'health', name: 'Health', description: '', formula: 'STR * 10' }],
  specialitySkills: [],
  combatSkills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  focusStatBonusLevel: 0,
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
  values: { name: string; formula: string }
) {
  await act(async () => {
    result.current.form.setValue('name', values.name);
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
    expect(useConfigStore.getState().config?.stats).toHaveLength(1);
    expect(result.current.isDialogOpen).toBe(false); // dialog was never opened in this test
  });

  it('should save a valid multi-reference formula', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleAdd());
    await submit(result, { name: 'Vitality', formula: 'STR * 2 + CON' });

    const stats = useConfigStore.getState().config?.stats ?? [];
    expect(stats).toHaveLength(2);
    expect(stats[1]).toMatchObject({ name: 'Vitality', formula: 'STR * 2 + CON' });
    expect(result.current.form.formState.errors.formula).toBeUndefined();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('should keep the dialog open and leave the stat untouched when the save is refused', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleEdit('health'));
    expect(result.current.isDialogOpen).toBe(true);

    await submit(result, { name: 'Health', formula: 'STR * WIS' });

    expect(result.current.isDialogOpen).toBe(true);
    expect(useConfigStore.getState().config?.stats[0].formula).toBe('STR * 10');
  });

  it('should refuse an unparseable formula', async () => {
    const { result } = renderStatManager();

    act(() => result.current.handleAdd());
    await submit(result, { name: 'Broken', formula: 'STR * * 2' });

    expect(result.current.form.formState.errors.formula).toBeDefined();
    expect(useConfigStore.getState().config?.stats).toHaveLength(1);
  });
});
