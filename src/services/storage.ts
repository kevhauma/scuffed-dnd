/**
 * Storage Service
 * 
 * LocalStorage abstraction for persisting Configuration and Character data.
 * Handles JSON serialization/deserialization and storage quota errors.
 * 
 * **Validates: Requirements 1.2, 17.1, 17.2, 17.3, 17.4, 17.5**
 */

import type { Configuration } from '../types/config';
import type { Character } from '../types/character';

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
  constructor(message: string, public readonly cause?: unknown) {
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
    const serialized = JSON.stringify(config);
    localStorage.setItem(STORAGE_KEYS.CONFIG, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new StorageQuotaError('Cannot save configuration: storage quota exceeded', error);
    }
    throw new StorageError('Failed to save configuration', error);
  }
}

/**
 * Load configuration from LocalStorage
 * 
 * @returns Configuration object or null if not found
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
    return config;
  } catch (error) {
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
    return Array.isArray(characters) ? characters : [];
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
