/**
 * App Hydration Hook
 *
 * Restores the saved configuration and characters from LocalStorage once per page load,
 * independent of which route the user landed on. Mounted by the root layout only.
 *
 * Three load branches (TICKET-IO-03): current data loads, **recognisably older data is refused
 * and left alone**, and unparseable data keeps the existing corrupt-data message. Only the middle
 * one has options attached, because it is the only one where the User still has something worth
 * keeping — and since CR-05 an unreadable *character* takes that branch too, not just an
 * unreadable ruleset.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5; v2.0 decision "Clean break on persisted data"**
 */

import { useCallback, useEffect, useState } from 'react';
import { downloadStoredBackup } from '../../services/configFiles';
import { isStorageAvailable, StorageSchemaError } from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import { useConfigStore } from '../../stores/configStore';

/**
 * The refusal branch, with the two things the User can do about it
 *
 * Present means **nothing was loaded and nothing was deleted** — the keys are still there.
 */
export interface IncompatibleStoredData {
  /** What was found, in the User's terms */
  message: string;
  /** Download the stored bytes exactly as they are */
  downloadBackup: () => void;
  /** Clear the keys and start from nothing — the caller confirms first */
  startFresh: () => void;
}

/**
 * What the root layout needs to know about hydration
 */
export interface AppHydration {
  /** False when LocalStorage is blocked or unavailable — show the notice instead of the app */
  storageAvailable: boolean;
  /** True once both stores have been restored (or found nothing to restore) */
  isHydrated: boolean;
  /** Message for a storage failure the user has to know about, otherwise null */
  storageError: string | null;
  /** Set when the stored data predates the current shape; null otherwise */
  incompatibleData: IncompatibleStoredData | null;
}

/**
 * Restore both persisted stores on mount
 *
 * Hydration is idempotent: each store's own `isLoaded` guard means navigating between routes
 * never re-reads LocalStorage, and a second mount is a no-op.
 *
 * Storage availability is probed before anything is read, so a browser with LocalStorage
 * disabled reports it once rather than throwing at the first read or write (Requirement 17.5).
 *
 * The characters follow the configuration's verdict — `loadConfig` throws before `loadCharacters`
 * is reached, so a refused ruleset never leaves a half-loaded app behind it. Since CR-05 the
 * characters have a verdict of their own: unrecognised character shapes are refused here too
 * rather than silently filtered away and overwritten by the next save.
 *
 * @returns Storage availability, hydration progress, and any error worth showing the user
 */

/**
 * What restoring the two stores came to
 *
 * Two different things to tell the User, and the distinction is TICKET-IO-03's: `incompatible`
 * means **nothing was loaded and nothing was deleted** — recognisably older data, still on disk,
 * with the choice about it still the User's — while `error` is data nobody can read at all.
 */
interface RestoreVerdict {
  incompatible?: string;
  error?: string;
}

/**
 * Restore whichever stores have not been restored yet, and classify what went wrong
 *
 * **Outside the hook**, so the try/catch and its two branches are not part of the hook's own
 * complexity — the split `fallow` asked for when CUR-02's migration pushed it over the threshold.
 * Each loader is `undefined` when that store is already loaded, which keeps the *when* with the
 * caller and the *what happened* here.
 *
 * @param loadConfig The ruleset loader, or nothing if it is already loaded
 * @param loadCharacters The roster loader, likewise
 * @returns Nothing at all when both succeeded
 */
function restoreStores(loadConfig?: () => void, loadCharacters?: () => void): RestoreVerdict {
  try {
    loadConfig?.();
    loadCharacters?.();

    return {};
  } catch (error) {
    // Refused, not failed: the data is still there and the User decides what happens to it
    if (error instanceof StorageSchemaError) return { incompatible: error.message };

    // Stored JSON can be corrupted; surface it instead of crashing every route
    return {
      error:
        error instanceof Error
          ? `Saved data could not be read: ${error.message}`
          : 'Saved data could not be read.',
    };
  }
}

export function useAppHydration(): AppHydration {
  const configIsLoaded = useConfigStore((state) => state.isLoaded);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const discardStoredData = useConfigStore((state) => state.discardStoredData);
  const charactersAreLoaded = useCharacterStore((state) => state.isLoaded);
  const loadCharacters = useCharacterStore((state) => state.loadCharacters);

  // null while unprobed — probing happens in an effect so the check never runs during render
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [incompatibleMessage, setIncompatibleMessage] = useState<string | null>(null);

  useEffect(() => {
    setStorageAvailable(isStorageAvailable());
  }, []);

  useEffect(() => {
    if (storageAvailable !== true) return;

    // The isLoaded guards make this run at most once per page load
    const verdict = restoreStores(
      configIsLoaded ? undefined : loadConfig,
      charactersAreLoaded ? undefined : loadCharacters
    );

    if (verdict.incompatible !== undefined) setIncompatibleMessage(verdict.incompatible);
    if (verdict.error !== undefined) setStorageError(verdict.error);

    // **Nothing was loaded**, so there is nothing to migrate and the keys are still the User's to
    // decide about. Converting against a half-restored store is how a refusal turns into a write.
    if (verdict.incompatible !== undefined || verdict.error !== undefined) return;

    /*
     * **The one shape migration the app performs** (TICKET-CUR-02). A per-tier `wallet` becomes a
     * base-tier `purse`, which needs the ruleset's **rates** — so it happens here, right after the
     * configuration has been read, rather than in `loadCharacters`, which has no ruleset, or in the
     * store, which cannot reach `configStore` without the cycle `no-circular` refuses.
     *
     * Both stores are read through `getState()` rather than through selectors, and that is
     * deliberate rather than lazy: this hook's complexity is **hook density** — `fallow` counts
     * fourteen calls in it and no branching worth speaking of — so a migration that cost two more
     * hooks pushed it past the threshold while changing nothing about how hard it is to read. Store
     * actions are stable, and an effect reading one at the moment it fires is the same value a
     * selector would have handed it.
     *
     * It writes nothing when there is nothing to convert, which is every load after the first.
     */
    useCharacterStore
      .getState()
      .adoptStoredWallets(useConfigStore.getState().config?.currencyTiers ?? []);
  }, [storageAvailable, configIsLoaded, charactersAreLoaded, loadConfig, loadCharacters]);

  // Reading and assembling the file is the service's job; this only decides when
  const downloadBackup = useCallback(() => downloadStoredBackup(), []);

  const startFresh = useCallback(() => {
    // Persistence — including the deletion — belongs to the store action
    discardStoredData();
    setIncompatibleMessage(null);
  }, [discardStoredData]);

  return {
    storageAvailable: storageAvailable !== false,
    isHydrated: configIsLoaded && charactersAreLoaded,
    storageError:
      storageAvailable === false
        ? 'Browser storage is unavailable, so nothing can be loaded or saved. Enable cookies and site data for this page, or leave private browsing, then reload.'
        : storageError,
    incompatibleData: incompatibleMessage
      ? { message: incompatibleMessage, downloadBackup, startFresh }
      : null,
  };
}
