/**
 * App Hydration Hook Tests
 *
 * The storage service is mocked so the real Zustand stores can be exercised without
 * touching LocalStorage.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5**
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration } from '../../types/config';

vi.mock('../../services/storage', () => ({
  isStorageAvailable: vi.fn(() => true),
  loadConfiguration: vi.fn(() => null),
  loadCharacters: vi.fn(() => []),
  saveConfiguration: vi.fn(),
  saveCharacters: vi.fn(),
}));

import { isStorageAvailable, loadCharacters, loadConfiguration } from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import { useConfigStore } from '../../stores/configStore';
import { useAppHydration } from './useAppHydration';

const storedConfig = {
  id: 'config1',
  name: 'Stored Config',
  version: '1.0',
  mainSkills: [],
  stats: [],
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
} satisfies Configuration;

const storedCharacter = {
  id: 'char1',
  name: 'Stored Character',
  configurationId: 'config1',
  raceIds: [],
  mainSkillLevels: {},
  specialitySkillBaseLevels: {},
  currentStatValues: {},
  inventory: { equippedItems: {}, miscItems: [] },
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
} satisfies Character;

describe('useAppHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isStorageAvailable).mockReturnValue(true);
    vi.mocked(loadConfiguration).mockReturnValue(storedConfig);
    vi.mocked(loadCharacters).mockReturnValue([storedCharacter]);
    useConfigStore.setState({ config: null, isLoaded: false });
    useCharacterStore.setState({ characters: [], isLoaded: false });
  });

  it('should restore the configuration and the characters into both stores', async () => {
    const { result } = renderHook(() => useAppHydration());

    await waitFor(() => expect(result.current.isHydrated).toBe(true));

    expect(useConfigStore.getState().config).toEqual(storedConfig);
    expect(useCharacterStore.getState().characters).toEqual([storedCharacter]);
    expect(result.current.storageAvailable).toBe(true);
    expect(result.current.storageError).toBeNull();
  });

  it('should not re-read storage on a second mount', async () => {
    const first = renderHook(() => useAppHydration());
    await waitFor(() => expect(first.result.current.isHydrated).toBe(true));

    expect(loadConfiguration).toHaveBeenCalledTimes(1);
    expect(loadCharacters).toHaveBeenCalledTimes(1);

    first.unmount();
    const second = renderHook(() => useAppHydration());
    await waitFor(() => expect(second.result.current.isHydrated).toBe(true));

    // The stores' isLoaded guards mean the second mount reads nothing
    expect(loadConfiguration).toHaveBeenCalledTimes(1);
    expect(loadCharacters).toHaveBeenCalledTimes(1);
  });

  it('should report unavailable storage instead of reading from it', async () => {
    vi.mocked(isStorageAvailable).mockReturnValue(false);

    const { result } = renderHook(() => useAppHydration());

    await waitFor(() => expect(result.current.storageAvailable).toBe(false));

    expect(result.current.storageError).toMatch(/storage is unavailable/i);
    expect(loadConfiguration).not.toHaveBeenCalled();
    expect(loadCharacters).not.toHaveBeenCalled();
    expect(result.current.isHydrated).toBe(false);
  });

  it('should surface a read failure as a message rather than throwing', async () => {
    vi.mocked(loadConfiguration).mockImplementation(() => {
      throw new Error('Configuration data is corrupted');
    });

    const { result } = renderHook(() => useAppHydration());

    await waitFor(() => expect(result.current.storageError).not.toBeNull());

    expect(result.current.storageError).toMatch(/Configuration data is corrupted/);
    expect(result.current.storageAvailable).toBe(true);
  });
});
