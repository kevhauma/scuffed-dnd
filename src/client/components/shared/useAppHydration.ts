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

    try {
      // The isLoaded guards make this run at most once per page load
      if (!configIsLoaded) loadConfig();
      if (!charactersAreLoaded) loadCharacters();
    } catch (error) {
      if (error instanceof StorageSchemaError) {
        // Refused, not failed: the data is still there and the User decides what happens to it
        setIncompatibleMessage(error.message);
        return;
      }

      // Stored JSON can be corrupted; surface it instead of crashing every route
      setStorageError(
        error instanceof Error
          ? `Saved data could not be read: ${error.message}`
          : 'Saved data could not be read.'
      );
    }
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
