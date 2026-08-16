/**
 * App Hydration Hook Tests
 *
 * The storage service is mocked so the real Zustand stores can be exercised without
 * touching LocalStorage.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5; v2.0 decision "Clean break on persisted data"**
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration } from '../../types/config';

vi.mock('../../services/storage', async () => {
  // The real error class, so `instanceof` in the hook means what it means in production
  const actual =
    await vi.importActual<typeof import('../../services/storage')>('../../services/storage');
  return {
    StorageSchemaError: actual.StorageSchemaError,
    isStorageAvailable: vi.fn(() => true),
    loadConfiguration: vi.fn(() => null),
    loadCharacters: vi.fn(() => []),
    saveConfiguration: vi.fn(),
    saveCharacters: vi.fn(),
    clearAllData: vi.fn(),
  };
});

vi.mock('../../services/importExport', () => ({
  downloadStoredBackup: vi.fn(),
}));

import { downloadStoredBackup } from '../../services/importExport';
import {
  clearAllData,
  isStorageAvailable,
  loadCharacters,
  loadConfiguration,
  StorageSchemaError,
  saveConfiguration,
} from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import { useConfigStore } from '../../stores/configStore';
import { useAppHydration } from './useAppHydration';

const storedConfig = {
  id: 'config1',
  name: 'Stored Config',
  version: '1.0',
  schemaVersion: 6,
  stats: [],
  skills: [],
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
  investedStatPoints: {},
  investedSkillPoints: {},
  currentResourceValues: {},
  experience: 0,
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
    // The corrupt branch has no options attached — there is nothing worth keeping
    expect(result.current.incompatibleData).toBeNull();
  });

  describe('the three load branches (TICKET-IO-03)', () => {
    /** Put the hook on the refusal branch */
    const refuseAsV1 = () => {
      vi.mocked(loadConfiguration).mockImplementation(() => {
        throw new StorageSchemaError('This browser holds a ruleset saved by an older version.');
      });
    };

    it('loads current data and reports no refusal', async () => {
      const { result } = renderHook(() => useAppHydration());

      await waitFor(() => expect(result.current.isHydrated).toBe(true));

      expect(useConfigStore.getState().config).toEqual(storedConfig);
      expect(result.current.incompatibleData).toBeNull();
    });

    it('refuses older data without loading or deleting anything', async () => {
      refuseAsV1();

      const { result } = renderHook(() => useAppHydration());

      await waitFor(() => expect(result.current.incompatibleData).not.toBeNull());

      expect(result.current.incompatibleData?.message).toMatch(/older version/);
      // Not a generic failure — the refusal has its own surface
      expect(result.current.storageError).toBeNull();
      // The characters follow the configuration's verdict
      expect(loadCharacters).not.toHaveBeenCalled();
      expect(useConfigStore.getState().config).toBeNull();
      expect(useCharacterStore.getState().characters).toEqual([]);
      // Nothing was written and nothing was cleared
      expect(clearAllData).not.toHaveBeenCalled();
    });

    it('never persists a fresh configuration over unconfirmed older data', async () => {
      refuseAsV1();

      const { result } = renderHook(() => useAppHydration());
      await waitFor(() => expect(result.current.incompatibleData).not.toBeNull());

      // `saveConfiguration` is the only way this module writes a ruleset; the refusal branch
      // leaves the store empty rather than seeding a default over data the User has not lost yet
      expect(saveConfiguration).not.toHaveBeenCalled();
      expect(useConfigStore.getState().isLoaded).toBe(false);
    });

    it('offers the backup without reading storage itself', async () => {
      refuseAsV1();

      const { result } = renderHook(() => useAppHydration());
      await waitFor(() => expect(result.current.incompatibleData).not.toBeNull());

      result.current.incompatibleData?.downloadBackup();

      // What the file contains is `downloadStoredBackup`'s own test — the hook only decides when
      expect(downloadStoredBackup).toHaveBeenCalledTimes(1);
    });

    it('clears the keys only when start-fresh is taken, and through the store action', async () => {
      refuseAsV1();

      const { result } = renderHook(() => useAppHydration());
      await waitFor(() => expect(result.current.incompatibleData).not.toBeNull());

      expect(clearAllData).not.toHaveBeenCalled();

      act(() => {
        result.current.incompatibleData?.startFresh();
      });

      await waitFor(() => expect(result.current.incompatibleData).toBeNull());

      // The store action is what reached storage — the hook never calls it directly
      expect(clearAllData).toHaveBeenCalledTimes(1);
      expect(useConfigStore.getState().config).toBeNull();
      expect(useConfigStore.getState().isLoaded).toBe(true);
      expect(useCharacterStore.getState().isLoaded).toBe(true);
    });
  });
});
