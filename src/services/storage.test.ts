/**
 * Storage Service Tests
 *
 * Unit tests for LocalStorage abstraction
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import {
  clearAllData,
  getStorageSize,
  isStorageAvailable,
  loadCharacters,
  loadConfiguration,
  readStoredSnapshot,
  StorageError,
  StorageParseError,
  StorageQuotaError,
  StorageSchemaError,
  saveCharacters,
  saveConfiguration,
} from './storage';

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
        focusStatBonusLevel: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      saveConfiguration(config);

      const stored = localStorage.getItem('dnd_builder_config');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored ?? '')).toEqual(config);
    });

    it('should throw StorageQuotaError when quota is exceeded', () => {
      const config: Configuration = {
        id: 'test-config',
        name: 'Test Config',
        version: '1.0.0',
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
          investedStatPoints: {},
          investedSkillPoints: {},
          currentResourceValues: {},
          experience: 0,
          inventory: { equippedItems: {}, miscItems: [] },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      saveCharacters(characters);

      const stored = localStorage.getItem('dnd_builder_characters');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored ?? '')).toEqual(characters);
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
          investedStatPoints: {},
          investedSkillPoints: {},
          currentResourceValues: {},
          experience: 0,
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
  describe('the v1 clean break (TICKET-STAT-01)', () => {
    /** A ruleset as v1 wrote it: main skills, no `schemaVersion`, stats that are all formulas */
    const v1Config = {
      id: 'old',
      name: 'Old Ruleset',
      version: '1.0.0',
      mainSkills: [{ id: 'id-str', code: 'STR', name: 'Strength', description: '', maxLevel: 20 }],
      stats: [{ id: 'id-hp', name: 'Health', description: '', formula: 'STR * 10' }],
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
    };

    it('refuses a v1 ruleset by name rather than crashing on a field that is not there', () => {
      localStorage.setItem('dnd_builder_config', JSON.stringify(v1Config));

      // Converting is not on the table: v1's focus stat, spend-derived level and speciality base
      // levels have no faithful mapping, so a conversion would invent a ruleset nobody authored
      expect(() => loadConfiguration()).toThrow(StorageSchemaError);
    });

    it('says what the User can do about it', () => {
      localStorage.setItem('dnd_builder_config', JSON.stringify(v1Config));

      expect(() => loadConfiguration()).toThrow(/older version of the app/);
    });

    it('drops a v1 character rather than handing back one every read would crash on', () => {
      localStorage.setItem(
        'dnd_builder_characters',
        JSON.stringify([
          { id: 'old', name: 'Aria', mainSkillLevels: { STR: 5 }, currentStatValues: {} },
          {
            id: 'new',
            name: 'Bree',
            investedStatPoints: { 'id-str': 5 },
            currentResourceValues: {},
            experience: 0,
          },
        ])
      );

      expect(loadCharacters().map((character) => character.id)).toEqual(['new']);
    });

    /**
     * A character written before TICKET-RES-01 has no `experience` (TICKET-RES-01)
     *
     * Its absence is the *quiet* kind, which is why it is filtered rather than trusted: the
     * schemaVersion gate reads the **Configuration**, so a characters key beside a fresh or absent
     * config never meets IO-03's notice (IO-03 implementation note 5). Left through,
     * `lookupCurve(curve, undefined)` falls past every range check and returns the first row — a
     * confident level 1 — and an award computes `undefined + n` and persists `NaN`.
     */
    it.each([
      ['absent', undefined],
      ['null', null],
      ['not a number', 'lots'],
      ['NaN', Number.NaN],
    ])('drops a character whose experience is %s', (_label, experience) => {
      localStorage.setItem(
        'dnd_builder_characters',
        JSON.stringify([
          {
            id: 'stale',
            name: 'Aria',
            investedStatPoints: { 'id-str': 5 },
            currentResourceValues: {},
            ...(experience === undefined ? {} : { experience }),
          },
          {
            id: 'new',
            name: 'Bree',
            investedStatPoints: { 'id-str': 5 },
            currentResourceValues: {},
            experience: 0,
          },
        ])
      );

      expect(loadCharacters().map((character) => character.id)).toEqual(['new']);
    });

    it('leaves the refused ruleset byte-identical in storage (TICKET-IO-03)', () => {
      const raw = JSON.stringify(v1Config);
      localStorage.setItem('dnd_builder_config', raw);

      expect(() => loadConfiguration()).toThrow(StorageSchemaError);

      // Refused, not removed — the User has not decided anything yet
      expect(localStorage.getItem('dnd_builder_config')).toBe(raw);
    });
  });

  describe('readStoredSnapshot (TICKET-IO-03)', () => {
    it('hands back both blobs exactly as stored, without parsing them', () => {
      // Deliberately ugly spacing: a snapshot that came back re-serialised would lose it
      const rawConfig = '{ "id":"old",  "name" : "Old Ruleset" }';
      const rawCharacters = '[ {"id":"aria"} ]';
      localStorage.setItem('dnd_builder_config', rawConfig);
      localStorage.setItem('dnd_builder_characters', rawCharacters);

      expect(readStoredSnapshot()).toEqual({ config: rawConfig, characters: rawCharacters });
    });

    it('reports an absent key as null rather than as an empty string', () => {
      expect(readStoredSnapshot()).toEqual({ config: null, characters: null });
    });

    it('reads data no other function in this module can open', () => {
      // The whole point: the backup path works on exactly the bytes `loadConfiguration` refused
      localStorage.setItem('dnd_builder_config', '{"id":"old","version":"1.0.0"}');

      expect(() => loadConfiguration()).toThrow(StorageSchemaError);
      expect(readStoredSnapshot().config).toBe('{"id":"old","version":"1.0.0"}');
    });
  });

  describe('reference form at the storage boundary (TICKET-REF-01)', () => {
    const config: Configuration = {
      id: 'test-config',
      name: 'Test Config',
      version: '1.0.0',
      schemaVersion: 6,
      stats: [
        {
          id: 'id-str',
          name: 'Strength',
          abbreviation: 'STR',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
        },
        {
          id: 'id-hp',
          name: 'Health',
          abbreviation: 'HEA',
          description: '',
          order: 0,
          countsTowardTotal: true,
          isResource: false,
          rounding: 'none',
          formula: 'STR * 10',
        },
      ],
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
    };

    it('writes formulas with references resolved to ids', () => {
      saveConfiguration(config);

      const raw = JSON.parse(localStorage.getItem('dnd_builder_config') as string) as Configuration;
      expect(raw.stats.find((candidate) => candidate.formula)?.formula).toBe('[id-str] * 10');
    });

    it('hands back the display form on load', () => {
      saveConfiguration(config);

      expect(loadConfiguration()).toEqual(config);
    });

    it('spells a stored formula with the abbreviation the stat has now', () => {
      saveConfiguration(config);

      const raw = JSON.parse(localStorage.getItem('dnd_builder_config') as string);
      raw.stats[0].abbreviation = 'STG';
      localStorage.setItem('dnd_builder_config', JSON.stringify(raw));

      expect(loadConfiguration()?.stats.find((candidate) => candidate.formula)?.formula).toBe(
        'STG * 10'
      );
    });

    it('completes a configuration written before entities had ids', () => {
      const legacy = {
        ...config,
        stats: config.stats.map(({ id: _dropped, ...rest }: (typeof config.stats)[number]) => rest),
      };
      localStorage.setItem('dnd_builder_config', JSON.stringify(legacy));

      const loaded = loadConfiguration();
      expect(loaded?.stats[0].id).toBeTruthy();
      expect(loaded?.stats.find((candidate) => candidate.formula)?.formula).toBe('STR * 10');
    });
  });
});
