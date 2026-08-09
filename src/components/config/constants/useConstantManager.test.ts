/**
 * Constant Manager Hook Tests
 *
 * The store is real with storage mocked, so a save that goes through really lands in the
 * configuration and a refused one really does not. Covers the two rules TICKET-CST-01 could only
 * enforce at the import boundary — the identifier pattern and name uniqueness — plus the
 * rename-safety the store's update provides and the guarded delete it returns.
 *
 * **Validates: Concept 05; Concept 00 §6; Requirements 2.5, 2.6**
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
import { useConstantManager } from './useConstantManager';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 2,
  stats: [
    {
      id: 'str-id',
      name: 'Strength',
      abbreviation: 'STR',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
    },
    {
      id: 'bonus',
      name: 'Bonus',
      abbreviation: 'BON',
      description: '',
      order: 0,
      countsTowardTotal: true,
      isResource: false,
      rounding: 'none',
      formula: 'STR / const.bonus_divider',
    },
  ],
  specialitySkills: [],
  combatSkills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  constants: [
    {
      id: 'div-id',
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description: 'Levels per point of bonus.',
      value: 5,
    },
    {
      id: 'apt-id',
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack.',
      value: 30,
      unit: 'speed',
    },
  ],
  focusStatBonusLevel: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

/**
 * `formState` is a proxy: reading `errors` inside the render subscribes to it, without which
 * the hook never re-renders on `setError` and the snapshot stays stale.
 */
function renderConstantManager() {
  return renderHook(() => {
    const manager = useConstantManager();
    void manager.form.formState.errors;
    return manager;
  });
}

type Manager = ReturnType<typeof useConstantManager>;

async function submit(
  result: { current: Manager },
  values: Partial<{
    name: string;
    displayName: string;
    description: string;
    value: number;
    unit: string;
  }>
) {
  await act(async () => {
    result.current.form.setValue('name', values.name ?? '');
    result.current.form.setValue('displayName', values.displayName ?? '');
    result.current.form.setValue('description', values.description ?? '');
    result.current.form.setValue('value', values.value ?? 0);
    result.current.form.setValue('unit', values.unit ?? '');
  });
  await act(async () => {
    await result.current.handleSave();
  });
}

function constants() {
  return useConfigStore.getState().config?.constants ?? [];
}

describe('useConstantManager', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('should add a constant through the store, keeping an empty unit off the entity', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleAdd());
    await submit(result, {
      name: 'crit_multiplier',
      displayName: 'Crit multiplier',
      description: 'What a critical hit multiplies damage by.',
      value: 2,
    });

    expect(constants()).toHaveLength(3);
    expect(constants()[2]).toMatchObject({
      name: 'crit_multiplier',
      displayName: 'Crit multiplier',
      value: 2,
    });
    expect(constants()[2].unit).toBeUndefined();
    expect(result.current.isDialogOpen).toBe(false);
  });

  it('should edit an existing constant in place rather than adding one', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleEdit('div-id'));
    expect(result.current.form.getValues('displayName')).toBe('Bonus divider');

    await submit(result, {
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description: 'Levels per point of bonus.',
      value: 4,
    });

    expect(constants()).toHaveLength(2);
    expect(constants().find((constant) => constant.id === 'div-id')?.value).toBe(4);
  });

  it('should clear a unit the User emptied, which a merged patch would otherwise keep', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleEdit('apt-id'));
    expect(result.current.form.getValues('unit')).toBe('speed');

    await submit(result, {
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack.',
      value: 30,
      unit: '',
    });

    expect(constants().find((constant) => constant.id === 'apt-id')?.unit).toBeUndefined();
  });

  it('should re-spell dependent formulas when the identifier is renamed', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleEdit('div-id'));
    await submit(result, {
      name: 'bonus_scale',
      displayName: 'Bonus scale',
      description: 'Levels per point of bonus.',
      value: 5,
    });

    // TICKET-REF-01: the id is the identity, the spelling is display data
    expect(constants().find((constant) => constant.id === 'div-id')?.name).toBe('bonus_scale');
    expect(
      useConfigStore.getState().config?.stats.find((candidate) => candidate.formula)?.formula
    ).toBe('STR / const.bonus_scale');
  });

  it('should refuse an identifier a formula could not spell, and keep the dialog open', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleAdd());
    await submit(result, {
      name: 'Bonus Divider',
      displayName: 'Bonus divider',
      description: 'Levels per point of bonus.',
      value: 5,
    });

    expect(result.current.form.formState.errors.name?.message).toMatch(/lowercase/i);
    expect(constants()).toHaveLength(2);
    expect(result.current.isDialogOpen).toBe(true);
  });

  it('should refuse a duplicate identifier, which would split identity from value', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleAdd());
    await submit(result, {
      name: 'apt_value',
      displayName: 'Another APT',
      description: 'A second constant claiming the same name.',
      value: 12,
    });

    expect(result.current.form.formState.errors.name?.message).toContain('apt_value');
    expect(constants()).toHaveLength(2);
  });

  it('should let a constant keep its own name while being edited', async () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleEdit('apt-id'));
    await submit(result, {
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack.',
      value: 25,
    });

    expect(result.current.form.formState.errors.name).toBeUndefined();
    expect(constants().find((constant) => constant.id === 'apt-id')?.value).toBe(25);
  });

  it('should list the formulas naming each constant', () => {
    const { result } = renderConstantManager();

    expect(result.current.usages.get('div-id')).toEqual([
      { holderKind: 'Stat', holderName: 'Bonus', field: 'formula', holderId: 'bonus' },
    ]);
    expect(result.current.usages.get('apt-id')).toEqual([]);
  });

  it('should refuse to delete a referenced constant and report what points at it', () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleDelete('div-id'));

    expect(constants()).toHaveLength(2);
    expect(result.current.blocked?.label).toContain('Bonus divider');
    expect(result.current.blocked?.references).toHaveLength(1);
    expect(result.current.blocked?.references[0].holderName).toBe('Bonus');
  });

  it('should delete an unreferenced constant without asking', () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleDelete('apt-id'));

    expect(constants().map((constant) => constant.id)).toEqual(['div-id']);
    expect(result.current.blocked).toBeNull();
  });

  it('should delete anyway when the User insists', () => {
    const { result } = renderConstantManager();

    act(() => result.current.handleDelete('div-id'));
    act(() => result.current.blocked?.force());

    expect(constants().map((constant) => constant.id)).toEqual(['apt-id']);
    expect(result.current.blocked).toBeNull();
  });
});
