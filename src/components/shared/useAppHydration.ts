/**
 * App Hydration Hook
 *
 * Restores the saved configuration and characters from LocalStorage once per page load,
 * independent of which route the user landed on. Mounted by the root layout only.
 *
 * **Validates: Requirements 17.3, 17.4, 17.5**
 */

import { useEffect, useState } from 'react';
import { isStorageAvailable } from '../../services/storage';
import { useCharacterStore } from '../../stores/characterStore';
import { useConfigStore } from '../../stores/configStore';

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
 * @returns Storage availability, hydration progress, and any error worth showing the user
 */
export function useAppHydration(): AppHydration {
  const configIsLoaded = useConfigStore((state) => state.isLoaded);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const charactersAreLoaded = useCharacterStore((state) => state.isLoaded);
  const loadCharacters = useCharacterStore((state) => state.loadCharacters);

  // null while unprobed — probing happens in an effect so the check never runs during render
  const [storageAvailable, setStorageAvailable] = useState<boolean | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

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
      // Stored JSON can be corrupted; surface it instead of crashing every route
      setStorageError(
        error instanceof Error
          ? `Saved data could not be read: ${error.message}`
          : 'Saved data could not be read.'
      );
    }
  }, [storageAvailable, configIsLoaded, charactersAreLoaded, loadConfig, loadCharacters]);

  return {
    storageAvailable: storageAvailable !== false,
    isHydrated: configIsLoaded && charactersAreLoaded,
    storageError:
      storageAvailable === false
        ? 'Browser storage is unavailable, so nothing can be loaded or saved. Enable cookies and site data for this page, or leave private browsing, then reload.'
        : storageError,
  };
}
