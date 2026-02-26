/**
 * Storage Service Tests
 * 
 * Unit tests for LocalStorage abstraction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveConfiguration,
  loadConfiguration,
  saveCharacters,
  loadCharacters,
  clearAllData,
  isStorageAvailable,
  getStorageSize,
  StorageQuotaError,
  StorageParseError,
  StorageError,
} from './storage';
import type { Configuration } from '../types/config';
import type { Character } from '../types/character';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

// Replace global localStorage
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Storage Service', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('saveConfiguration', () => {
    it('should save configuration to localStorage', () => {
      const config: Configuration = {
        id: 'test-config',
        name: 'Test Config',
        version: '1.0.0',
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
        focusStatBonusLevel: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      saveConfiguration(config);

      const stored = localStorage.getItem('dnd_builder_config');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(config);
    });

    it('should throw StorageQuotaError when quota is exceeded', () => {
      const config: Configuration = {
        id: 'test-config',
        name: 'Test Config',
        version: '1.0.0',
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
        focusStatBonusLevel: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock quota exceeded error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => saveConfiguration(config)).toThrow(StorageQuotaError);
      expect(() => saveConfiguration(config)).toThrow('storage quota exceeded');

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should throw StorageError for other errors', () => {
      const config: Configuration = {
        id: 'test-config',
        name: 'Test Config',
        version: '1.0.0',
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
        focusStatBonusLevel: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      // Mock generic error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Generic error');
      });

      expect(() => saveConfiguration(config)).toThrow(StorageError);

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('loadConfiguration', () => {
    it('should load configuration from localStorage', () => {
      const config: Configuration = {
        id: 'test-config',
        name: 'Test Config',
        version: '1.0.0',
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
        focusStatBonusLevel: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      localStorage.setItem('dnd_builder_config', JSON.stringify(config));

      const loaded = loadConfiguration();
      expect(loaded).toEqual(config);
    });

    it('should return null when no configuration exists', () => {
      const loaded = loadConfiguration();
      expect(loaded).toBeNull();
    });

    it('should throw StorageParseError for corrupted data', () => {
      localStorage.setItem('dnd_builder_config', 'invalid json {{{');

      expect(() => loadConfiguration()).toThrow(StorageParseError);
      expect(() => loadConfiguration()).toThrow('corrupted');
    });
  });

  describe('saveCharacters', () => {
    it('should save character array to localStorage', () => {
      const characters: Character[] = [
        {
          id: 'char-1',
          name: 'Test Character',
          configurationId: 'config-1',
          raceIds: [],
          mainSkillLevels: {},
          specialitySkillBaseLevels: {},
          currentStatValues: {},
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      saveCharacters(characters);

      const stored = localStorage.getItem('dnd_builder_characters');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(characters);
    });

    it('should throw StorageQuotaError when quota is exceeded', () => {
      const characters: Character[] = [];

      // Mock quota exceeded error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      expect(() => saveCharacters(characters)).toThrow(StorageQuotaError);

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('loadCharacters', () => {
    it('should load character array from localStorage', () => {
      const characters: Character[] = [
        {
          id: 'char-1',
          name: 'Test Character',
          configurationId: 'config-1',
          raceIds: [],
          mainSkillLevels: {},
          specialitySkillBaseLevels: {},
          currentStatValues: {},
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      localStorage.setItem('dnd_builder_characters', JSON.stringify(characters));

      const loaded = loadCharacters();
      expect(loaded).toEqual(characters);
    });

    it('should return empty array when no characters exist', () => {
      const loaded = loadCharacters();
      expect(loaded).toEqual([]);
    });

    it('should return empty array for non-array data', () => {
      localStorage.setItem('dnd_builder_characters', JSON.stringify({ invalid: 'data' }));

      const loaded = loadCharacters();
      expect(loaded).toEqual([]);
    });

    it('should throw StorageParseError for corrupted data', () => {
      localStorage.setItem('dnd_builder_characters', 'invalid json [[[');

      expect(() => loadCharacters()).toThrow(StorageParseError);
    });
  });

  describe('clearAllData', () => {
    it('should remove all stored data', () => {
      localStorage.setItem('dnd_builder_config', 'test');
      localStorage.setItem('dnd_builder_characters', 'test');
      localStorage.setItem('dnd_builder_ui_state', 'test');

      clearAllData();

      expect(localStorage.getItem('dnd_builder_config')).toBeNull();
      expect(localStorage.getItem('dnd_builder_characters')).toBeNull();
      expect(localStorage.getItem('dnd_builder_ui_state')).toBeNull();
    });
  });

  describe('isStorageAvailable', () => {
    it('should return true when storage is available', () => {
      expect(isStorageAvailable()).toBe(true);
    });

    it('should return false when storage is not available', () => {
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage not available');
      });

      expect(isStorageAvailable()).toBe(false);

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('getStorageSize', () => {
    it('should return 0 for empty storage', () => {
      localStorageMock.clear();
      expect(getStorageSize()).toBe(0);
    });

    it('should calculate approximate storage size', () => {
      localStorageMock.clear();
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');

      const size = getStorageSize();
      // key1 (4) + value1 (6) + key2 (4) + value2 (6) = 20
      expect(size).toBeGreaterThan(0);
    });
  });
});
