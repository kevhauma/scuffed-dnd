/**
 * Storage Service
 *
 * LocalStorage abstraction for persisting Configuration and Character data.
 * Handles JSON serialization/deserialization and storage quota errors.
 *
 * This is the boundary where a configuration changes form (TICKET-REF-01): what is written holds
 * **id-resolved** references, what is handed back holds the **display spellings** the ruleset
 * currently uses. Everything above this layer — stores, engine, components — works in display
 * form only, which is why nothing else had to learn about ids.
 *
 * **Validates: Requirements 1.2, 17.1, 17.2, 17.3, 17.4, 17.5; Concept 00 §6**
 */

import {
  ensureReferenceIds,
  toDisplayConfiguration,
  toStoredConfiguration,
} from '../engine/formula/references';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';

// LocalStorage keys
const STORAGE_KEYS = {
  CONFIG: 'dnd_builder_config',
  CHARACTERS: 'dnd_builder_characters',
  UI_STATE: 'dnd_builder_ui_state',
} as const;

/**
 * Storage error types
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(message: string = 'Storage quota exceeded', cause?: unknown) {
    super(message, cause);
    this.name = 'StorageQuotaError';
  }
}

export class StorageParseError extends StorageError {
  constructor(message: string = 'Failed to parse stored data', cause?: unknown) {
    super(message, cause);
    this.name = 'StorageParseError';
  }
}

/**
 * Save configuration to LocalStorage
 *
 * @throws {StorageQuotaError} When storage quota is exceeded
 * @throws {StorageError} When serialization or storage fails
 */
export function saveConfiguration(config: Configuration): void {
  try {
    const serialized = JSON.stringify(toStoredConfiguration(config));
    localStorage.setItem(STORAGE_KEYS.CONFIG, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new StorageQuotaError('Cannot save configuration: storage quota exceeded', error);
    }
    throw new StorageError('Failed to save configuration', error);
  }
}

/**
 * A stored ruleset written before the unified stat model (TICKET-STAT-01)
 *
 * Thrown rather than converted: v1's focus stat, spend-derived level and speciality base levels
 * have no faithful mapping into the v2 shape, so a silent conversion would invent a ruleset
 * nobody authored. TICKET-IO-03 turns this into the notice the User actually sees; this exists so
 * that until it does, a v1 browser gets a named refusal rather than a `TypeError` from the first
 * field that isn't there.
 */
export class StorageSchemaError extends StorageError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageSchemaError';
  }
}

/** The persisted shape this build reads; anything else is refused rather than converted */
const SUPPORTED_SCHEMA_VERSION = 2;

/**
 * Load configuration from LocalStorage
 *
 * @returns Configuration object or null if not found
 * @throws {StorageSchemaError} When the stored ruleset predates the unified stat model
 * @throws {StorageParseError} When stored data is invalid JSON
 * @throws {StorageError} When retrieval fails
 */
export function loadConfiguration(): Configuration | null {
  try {
    const serialized = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!serialized) {
      return null;
    }

    const config = JSON.parse(serialized) as Configuration;
    if (config.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
      throw new StorageSchemaError(
        'This saved ruleset was written by an older version of the app and cannot be opened. ' +
          'Export it from that version, or start a new ruleset.'
      );
    }

    return toDisplayConfiguration(ensureReferenceIds(config, () => crypto.randomUUID()));
  } catch (error) {
    if (error instanceof StorageSchemaError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new StorageParseError('Configuration data is corrupted', error);
    }
    throw new StorageError('Failed to load configuration', error);
  }
}

/**
 * Save character array to LocalStorage
 *
 * @throws {StorageQuotaError} When storage quota is exceeded
 * @throws {StorageError} When serialization or storage fails
 */
export function saveCharacters(characters: Character[]): void {
  try {
    const serialized = JSON.stringify(characters);
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new StorageQuotaError('Cannot save characters: storage quota exceeded', error);
    }
    throw new StorageError('Failed to save characters', error);
  }
}

/**
 * Load character array from LocalStorage
 *
 * @returns Array of characters or empty array if not found
 * @throws {StorageParseError} When stored data is invalid JSON
 * @throws {StorageError} When retrieval fails
 */
export function loadCharacters(): Character[] {
  try {
    const serialized = localStorage.getItem(STORAGE_KEYS.CHARACTERS);
    if (!serialized) {
      return [];
    }

    const characters = JSON.parse(serialized) as Character[];
    if (!Array.isArray(characters)) return [];

    // A character written before TICKET-STAT-01 has no `investedStatPoints` at all, and every
    // read of it would be a crash rather than a number. Dropped rather than converted, for the
    // same reason the configuration is refused: v1 allocations have nowhere faithful to go.
    return characters.filter(
      (character) =>
        character?.investedStatPoints !== undefined &&
        character?.currentResourceValues !== undefined
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new StorageParseError('Character data is corrupted', error);
    }
    throw new StorageError('Failed to load characters', error);
  }
}

/**
 * Clear all stored data (useful for testing or reset)
 */
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.CONFIG);
  localStorage.removeItem(STORAGE_KEYS.CHARACTERS);
  localStorage.removeItem(STORAGE_KEYS.UI_STATE);
}

/**
 * Check if storage is available and has space
 *
 * @returns true if storage is available, false otherwise
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get approximate storage usage in bytes
 *
 * @returns Approximate size of stored data in bytes
 */
export function getStorageSize(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length || 0);
    }
  }
  return total;
}
