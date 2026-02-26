/**
 * Import/Export Service Tests
 * 
 * Unit tests for configuration import/export functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportConfiguration,
  downloadConfiguration,
  validateConfiguration,
  importConfiguration,
  importConfigurationFromFile,
  ValidationError,
  ImportExportError,
} from './importExport';
import type { Configuration } from '../types/config';

describe('Import/Export Service', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = {
      id: 'test-config',
      name: 'Test Config',
      version: '1.0.0',
      mainSkills: [
        { code: 'STR', name: 'Strength', description: 'Physical power', maxLevel: 10 },
        { code: 'DEX', name: 'Dexterity', description: 'Agility', maxLevel: 10 },
      ],
      stats: [
        { id: 'health', name: 'Health', description: 'Hit points', formula: 'STR * 10' },
      ],
      specialitySkills: [
        {
          code: 'MEL',
          name: 'Melee',
          description: 'Close combat',
          maxBaseLevel: 10,
          bonusFormula: 'STR + DEX',
        },
      ],
      combatSkills: [
        {
          code: 'ATK',
          name: 'Attack',
          description: 'Basic attack',
          dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 1 },
          bonusFormula: 'STR + MEL',
        },
      ],
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
  });

  describe('exportConfiguration', () => {
    it('should export configuration as JSON blob', () => {
      const blob = exportConfiguration(validConfig);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should create valid JSON content', () => {
      const blob = exportConfiguration(validConfig);
      
      // Read blob content using FileReader-like approach
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const text = reader.result as string;
          const parsed = JSON.parse(text);
          expect(parsed).toEqual(validConfig);
          resolve();
        };
        reader.readAsText(blob);
      });
    });

    it('should format JSON with indentation', () => {
      const blob = exportConfiguration(validConfig);
      
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const text = reader.result as string;
          // Check for indentation (formatted JSON has newlines and spaces)
          expect(text).toContain('\n');
          expect(text).toContain('  ');
          resolve();
        };
        reader.readAsText(blob);
      });
    });
  });

  describe('downloadConfiguration', () => {
    beforeEach(() => {
      // Mock DOM methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      document.createElement = vi.fn((tag: string) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            click: vi.fn(),
          } as unknown as HTMLAnchorElement;
        }
        return {} as HTMLElement;
      });
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
    });

    it('should trigger download with default filename', () => {
      downloadConfiguration(validConfig);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
    });

    it('should use custom filename when provided', () => {
      const customFilename = 'my-config.json';
      const createElementSpy = vi.spyOn(document, 'createElement');

      downloadConfiguration(validConfig, customFilename);

      const linkElement = createElementSpy.mock.results[0]?.value as HTMLAnchorElement;
      expect(linkElement.download).toBe(customFilename);
    });

    it('should clean up URL after download', () => {
      downloadConfiguration(validConfig);

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const result = validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object data', () => {
      const result = validateConfiguration('not an object');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should reject null data', () => {
      const result = validateConfiguration(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuration must be an object');
    });

    it('should validate required string fields', () => {
      const invalid = { ...validConfig, name: 123 };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should validate required number fields', () => {
      const invalid = { ...validConfig, focusStatBonusLevel: 'not a number' };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('focusStatBonusLevel'))).toBe(true);
    });

    it('should validate required array fields', () => {
      const invalid = { ...validConfig, mainSkills: 'not an array' };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('mainSkills'))).toBe(true);
    });

    it('should validate main skill structure', () => {
      const invalid = {
        ...validConfig,
        mainSkills: [{ code: 'TOOLONG', name: 'Invalid', maxLevel: 10 }],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('3-letter'))).toBe(true);
    });

    it('should validate stat structure', () => {
      const invalid = {
        ...validConfig,
        stats: [{ id: 'test', name: 'Test' }], // Missing formula
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('formula'))).toBe(true);
    });

    it('should validate speciality skill structure', () => {
      const invalid = {
        ...validConfig,
        specialitySkills: [
          { code: 'AB', name: 'Invalid', bonusFormula: 'STR' }, // Code too short
        ],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('3-letter'))).toBe(true);
    });

    it('should validate combat skill structure', () => {
      const invalid = {
        ...validConfig,
        combatSkills: [
          { code: 'ATK', name: 'Attack', bonusFormula: 'STR' }, // Missing dice
        ],
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('dice'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const invalid = {
        ...validConfig,
        name: 123,
        focusStatBonusLevel: 'invalid',
        mainSkills: 'not an array',
      };
      const result = validateConfiguration(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('importConfiguration', () => {
    it('should import valid JSON configuration', () => {
      const json = JSON.stringify(validConfig);
      const imported = importConfiguration(json);

      expect(imported).toEqual(validConfig);
    });

    it('should throw ValidationError for invalid configuration', () => {
      const invalid = { ...validConfig, name: 123 };
      const json = JSON.stringify(invalid);

      expect(() => importConfiguration(json)).toThrow(ValidationError);
    });

    it('should throw ImportExportError for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => importConfiguration(invalidJson)).toThrow(ImportExportError);
      expect(() => importConfiguration(invalidJson)).toThrow('Invalid JSON format');
    });

    it('should include validation errors in ValidationError', () => {
      const invalid = { ...validConfig, name: 123, focusStatBonusLevel: 'invalid' };
      const json = JSON.stringify(invalid);

      try {
        importConfiguration(json);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('importConfigurationFromFile', () => {
    it('should import configuration from file', async () => {
      const json = JSON.stringify(validConfig);
      const blob = new Blob([json], { type: 'application/json' });
      
      // Create a mock file with text() method
      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => json,
      }) as File;

      const imported = await importConfigurationFromFile(file);

      expect(imported).toEqual(validConfig);
    });

    it('should throw ValidationError for invalid file content', async () => {
      const invalid = { ...validConfig, name: 123 };
      const json = JSON.stringify(invalid);
      const blob = new Blob([json], { type: 'application/json' });
      
      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => json,
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ValidationError);
    });

    it('should throw ImportExportError for invalid JSON in file', async () => {
      const invalidJson = '{ invalid json }';
      const blob = new Blob([invalidJson], { type: 'application/json' });
      
      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => invalidJson,
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ImportExportError);
    });

    it('should handle file read errors', async () => {
      const blob = new Blob(['test'], { type: 'application/json' });
      
      const file = Object.assign(blob, {
        name: 'config.json',
        lastModified: Date.now(),
        text: async () => {
          throw new Error('Read error');
        },
      }) as File;

      await expect(importConfigurationFromFile(file)).rejects.toThrow(ImportExportError);
    });
  });
});
