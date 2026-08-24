/**
 * Currency Manager Hook Tests
 *
 * The store is real with storage mocked, so a save really lands in the configuration. Currency
 * tier `order` is the conversion ladder itself, so a save that changes it changes what the
 * ruleset's prices mean — which is what CR-04 was.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
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
import { useCurrencyManager } from './useCurrencyManager';

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 9,
  stats: [],
  skills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [
    { id: 'copper', name: 'Copper', order: 0, conversionToNext: 10 },
    { id: 'silver', name: 'Silver', order: 1, conversionToNext: 10 },
    { id: 'gold', name: 'Gold', order: 2, conversionToNext: 1 },
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

type Manager = ReturnType<typeof useCurrencyManager>;

async function submit(
  result: { current: Manager },
  values: { name: string; conversionToNext: number }
) {
  await act(async () => {
    result.current.form.setValue('name', values.name);
    result.current.form.setValue('conversionToNext', values.conversionToNext);
  });
  await act(async () => {
    await result.current.handleSave();
  });
}

/** The ladder as the store holds it, lowest first */
function ladder() {
  return [...(useConfigStore.getState().config?.currencyTiers ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((tier) => tier.id);
}

describe('useCurrencyManager', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  it('keeps the lowest tier at the bottom of the ladder when it is edited (CR-04)', async () => {
    const { result } = renderHook(() => useCurrencyManager());

    act(() => result.current.handleEdit('copper'));
    await submit(result, { name: 'Copper piece', conversionToNext: 12 });

    // `order: 0` is falsy, and `|| currentTiers.length` used to reassign it 3 — so renaming the
    // bottom of the ladder moved it to the top and inverted every conversion below gold
    expect(ladder()).toEqual(['copper', 'silver', 'gold']);
    expect(
      useConfigStore.getState().config?.currencyTiers.find((tier) => tier.id === 'copper')
    ).toMatchObject({ name: 'Copper piece', order: 0, conversionToNext: 12 });
  });

  it('keeps a middle tier in place too', async () => {
    const { result } = renderHook(() => useCurrencyManager());

    act(() => result.current.handleEdit('silver'));
    await submit(result, { name: 'Silver', conversionToNext: 20 });

    expect(ladder()).toEqual(['copper', 'silver', 'gold']);
  });

  it('puts a new tier at the top of the ladder', async () => {
    const { result } = renderHook(() => useCurrencyManager());

    act(() => result.current.handleAdd());
    await submit(result, { name: 'Platinum', conversionToNext: 1 });

    expect(ladder()).toEqual(['copper', 'silver', 'gold', expect.any(String)]);
    expect(useConfigStore.getState().config?.currencyTiers).toHaveLength(4);
  });

  it('renumbers the whole ladder on a move', async () => {
    const { result } = renderHook(() => useCurrencyManager());

    act(() => result.current.handleMoveDown(0));

    expect(ladder()).toEqual(['silver', 'copper', 'gold']);
  });
});
