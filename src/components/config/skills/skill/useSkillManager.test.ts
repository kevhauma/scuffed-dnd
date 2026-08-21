/**
 * Skill Manager Hook Tests
 *
 * Covers weight-row editing end to end (TICKET-SKL-03): adding, removing and changing a row all
 * reach the store through the manager's actions, an edit carries the skill's id through, and the
 * two ways a row can be junk — no stat, no number — are resolved on the way in rather than stored.
 *
 * **Validates: Concept 02**
 */

import { act, renderHook } from '@testing-library/react';
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
import { useSkillManager } from './useSkillManager';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 9,
  stats: [
    {
      id: 'stat-str',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 1,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'stat-dex',
      name: 'Dexterity',
      abbreviation: 'DEX',
      description: '',
      order: 0,
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
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function skillsInStore() {
  return useConfigStore.getState().config?.skills ?? [];
}

describe('useSkillManager', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should offer every stat as a weight target, in the order the User arranged them', () => {
    const { result } = renderHook(() => useSkillManager());

    expect(result.current.weightableStats.map((stat) => stat.abbreviation)).toEqual(['DEX', 'STR']);
  });

  it('should add a skill with the weight rows the form holds', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleAdd());
    act(() => {
      result.current.form.setValue('name', 'Cooking');
      result.current.form.setValue('description', '');
      result.current.form.setValue('statWeights', [
        { statId: 'stat-dex', weight: 0.2 },
        { statId: 'stat-str', weight: 0.1 },
      ]);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore()).toHaveLength(2);
    expect(skillsInStore().at(-1)).toMatchObject({
      name: 'Cooking',
      statWeights: [
        { statId: 'stat-dex', weight: 0.2 },
        { statId: 'stat-str', weight: 0.1 },
      ],
    });
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('should load an existing skill’s rows into the form when editing', () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleEdit('skill-smithing'));

    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.form.getValues('name')).toBe('Black smithing');
    expect(result.current.form.getValues('statWeights')).toEqual([
      { statId: 'stat-str', weight: 0.2 },
    ]);
  });

  it('should add a row to an existing skill without minting a new id', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleEdit('skill-smithing'));
    act(() => {
      result.current.form.setValue('statWeights', [
        { statId: 'stat-str', weight: 0.2 },
        { statId: 'stat-dex', weight: 0.1 },
      ]);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore()).toHaveLength(1);
    expect(skillsInStore()[0].id).toBe('skill-smithing');
    expect(skillsInStore()[0].statWeights).toEqual([
      { statId: 'stat-str', weight: 0.2 },
      { statId: 'stat-dex', weight: 0.1 },
    ]);
  });

  it('should remove a row when the form no longer holds it', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleEdit('skill-smithing'));
    act(() => result.current.form.setValue('statWeights', []));
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore()[0].statWeights).toEqual([]);
  });

  it('should change an existing row’s stat and weight', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleEdit('skill-smithing'));
    act(() => {
      result.current.form.setValue('statWeights', [{ statId: 'stat-dex', weight: 0.3 }]);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore()[0].statWeights).toEqual([{ statId: 'stat-dex', weight: 0.3 }]);
  });

  it('should drop a row that names no stat rather than storing an unresolvable target', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleAdd());
    act(() => {
      result.current.form.setValue('name', 'Foraging');
      result.current.form.setValue('description', '');
      result.current.form.setValue('statWeights', [
        { statId: 'stat-dex', weight: 0.2 },
        { statId: '', weight: 0.1 },
      ]);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore().at(-1)?.statWeights).toEqual([{ statId: 'stat-dex', weight: 0.2 }]);
  });

  it('should store an emptied weight box as 0 rather than NaN', async () => {
    const { result } = renderHook(() => useSkillManager());

    act(() => result.current.handleEdit('skill-smithing'));
    act(() => {
      // What `valueAsNumber` reads back from a cleared number input
      result.current.form.setValue('statWeights', [{ statId: 'stat-str', weight: Number.NaN }]);
    });
    await act(async () => {
      await result.current.handleSave();
    });

    expect(skillsInStore()[0].statWeights).toEqual([{ statId: 'stat-str', weight: 0 }]);
  });
});
