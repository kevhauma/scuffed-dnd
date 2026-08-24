/**
 * Import/Export Service — the browser-file half
 *
 * Everything about moving a Configuration between the app and the User's disk that needs a
 * browser: `Blob`, `URL.createObjectURL`, the download anchor, and reading a `File`. The seam
 * (TICKET-DX-07, D14) is exactly "does this touch a browser API" — the parsing, version gating,
 * validation and reference translation are in `#shared/services/importExport`, where the server
 * reuses them rather than growing a second copy.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
 */

import {
  ImportExportError,
  importConfiguration,
  serializeConfiguration,
  ValidationError,
} from '#shared/services/importExport';
import type { Configuration } from '#shared/types/config';
import { readStoredSnapshot } from './storage';

/**
 * Export configuration as JSON file
 *
 * Creates a downloadable JSON file with the configuration data.
 *
 * @param config Configuration to export
 * @returns Blob containing the JSON data
 */
export function exportConfiguration(config: Configuration): Blob {
  return new Blob([serializeConfiguration(config)], { type: 'application/json' });
}

/**
 * Hand a blob to the browser as a download
 *
 * The DOM half of every export, kept in one place so the backup path (TICKET-IO-03) does not
 * grow a second copy of the anchor dance. Module-private: callers ask for a *download of
 * something*, not for a blob to be handed to the browser.
 *
 * @param blob What to download
 * @param filename What to call it
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Splice one stored blob into the backup envelope without re-serialising it
 *
 * A stored value that parses goes in **verbatim**, so the User's bytes are the file's bytes; one
 * that does not is embedded as a JSON string, so a corrupt blob is carried out intact instead of
 * producing a backup file that will not parse. The corrupt case is reachable: the refusal branch
 * validates the configuration and never looks at the characters.
 *
 * @param raw - The stored string, or null when the key is absent
 * @returns A JSON fragment safe to splice into the envelope
 */
function embedStoredBlob(raw: string | null): string {
  if (raw === null) return 'null';
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return JSON.stringify(raw);
  }
}

/**
 * Download everything LocalStorage holds, exactly as it holds it (TICKET-IO-03)
 *
 * The backup offered alongside the refusal notice, and the only export that works on data this
 * build cannot open — which is why it goes nowhere near `Configuration`. Assembled by
 * concatenation rather than by `JSON.stringify` on purpose: a round-trip through a parse would
 * hand the User something *equivalent to* what they had, which is not what a backup is for.
 *
 * @param filename Optional custom filename (defaults to a timestamped backup name)
 */
export function downloadStoredBackup(filename?: string): void {
  const snapshot = readStoredSnapshot();
  const contents =
    `{"dnd_builder_config":${embedStoredBlob(snapshot.config)},` +
    `"dnd_builder_characters":${embedStoredBlob(snapshot.characters)}}`;

  downloadBlob(
    new Blob([contents], { type: 'application/json' }),
    filename ?? `dnd_builder_backup_${Date.now()}.json`
  );
}

/**
 * Download configuration as JSON file
 *
 * Triggers a browser download of the configuration as a JSON file.
 *
 * @param config Configuration to download
 * @param filename Optional custom filename (defaults to config name + timestamp)
 */
export function downloadConfiguration(config: Configuration, filename?: string): void {
  try {
    const defaultFilename = `${config.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    downloadBlob(exportConfiguration(config), filename || defaultFilename);
  } catch (error) {
    throw new ImportExportError('Failed to download configuration', error);
  }
}

/**
 * Import configuration from File object
 *
 * Reads a File object and imports the configuration.
 *
 * @param file File object to read
 * @returns Promise resolving to parsed Configuration
 * @throws {ValidationError} If validation fails
 * @throws {ImportExportError} If reading or parsing fails
 */
export async function importConfigurationFromFile(file: File): Promise<Configuration> {
  try {
    const text = await file.text();
    return importConfiguration(text);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ImportExportError) {
      throw error;
    }
    throw new ImportExportError('Failed to read file', error);
  }
}
