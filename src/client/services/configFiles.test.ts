/**
 * Import/Export Service Tests — the browser-file half
 *
 * The `Blob`, download-anchor and `File` behaviour that TICKET-DX-07 moved out of
 * `shared/services/importExport.test.ts` when the service was split along the browser-API seam.
 * The parsing, validation and round-trip assertions stayed with the pure half.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ImportExportError,
  importConfiguration,
  ValidationError,
} from '#shared/services/importExport';
import { makeValidConfiguration } from '#shared/services/importExport.fixtures';
import type { Configuration } from '#shared/types/config';
import {
  downloadConfiguration,
  downloadStoredBackup,
  exportConfiguration,
  importConfigurationFromFile,
} from './configFiles';

describe('Import/Export Service — browser files', () => {
  let validConfig: Configuration;

  beforeEach(() => {
    validConfig = makeValidConfiguration();
  });

  describe('exportConfiguration', () => {
    it('should export configuration as JSON blob', () => {
      const blob = exportConfiguration(validConfig);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should create valid JSON content, with references resolved to ids (TICKET-REF-01)', () => {
      const blob = exportConfiguration(validConfig);

      // Read blob content using FileReader-like approach
      const reader = new FileReader();
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const text = reader.result as string;
          const parsed = JSON.parse(text) as Configuration;

          // Everything but the formulas is carried through untouched. A skill's weight rows are
          // keyed by stat id already, so there is nothing in them to resolve (TICKET-SKL-02).
          expect(parsed).toEqual({
            ...validConfig,
            stats: validConfig.stats.map((stat) =>
              stat.formula ? { ...stat, formula: '[STR] * 10' } : stat
            ),
            // Both persisted formula fields are id-resolved on the way out (TICKET-ROLL-06)
            rollDefinitions: [
              { ...validConfig.rollDefinitions?.[0], input: '[STR] + skills.[MEL]' },
            ],
          });

          // …and importing the file spells them the way this ruleset spells them again
          expect(importConfiguration(text)).toEqual(validConfig);
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

  describe('downloadStoredBackup (TICKET-IO-03)', () => {
    /** The blob handed to the browser, so the file's actual bytes can be read back */
    let downloaded: Blob | null;

    beforeEach(() => {
      downloaded = null;
      localStorage.clear();
      global.URL.createObjectURL = vi.fn((blob: Blob) => {
        downloaded = blob;
        return 'blob:mock-url';
      });
      global.URL.revokeObjectURL = vi.fn();
      vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    });

    it('writes both stored blobs into one file, byte for byte', async () => {
      // Deliberately ugly spacing — a re-serialised backup would lose it
      localStorage.setItem('dnd_builder_config', '{ "id":"old",  "name" : "Old Ruleset" }');
      localStorage.setItem('dnd_builder_characters', '[ {"id":"aria"} ]');

      downloadStoredBackup();

      const text = await downloaded?.text();
      expect(text).toContain('{ "id":"old",  "name" : "Old Ruleset" }');
      expect(text).toContain('[ {"id":"aria"} ]');
      // And it is still a file anything can read
      expect(JSON.parse(text ?? '').dnd_builder_config).toEqual({ id: 'old', name: 'Old Ruleset' });
    });

    it('names the file with a timestamp unless told otherwise', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');

      downloadStoredBackup();

      const link = createElementSpy.mock.results[0]?.value as HTMLAnchorElement;
      expect(link.download).toMatch(/^dnd_builder_backup_\d+\.json$/);
    });

    it('writes an absent key as null rather than as an empty value', async () => {
      localStorage.setItem('dnd_builder_config', '{"id":"old"}');

      downloadStoredBackup();

      const parsed = JSON.parse((await downloaded?.text()) ?? '');
      expect(parsed.dnd_builder_characters).toBeNull();
    });

    it('still produces a readable file when a stored blob is corrupt', async () => {
      // Reachable: the refusal branch validates the configuration and never parses the characters
      localStorage.setItem('dnd_builder_config', '{"id":"old"}');
      localStorage.setItem('dnd_builder_characters', '[ {broken');

      downloadStoredBackup();

      const parsed = JSON.parse((await downloaded?.text()) ?? '');
      // Carried out intact as a string — the one file the User is told to keep must parse
      expect(parsed.dnd_builder_characters).toBe('[ {broken');
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
