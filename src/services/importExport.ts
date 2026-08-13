/**
 * Import/Export Service
 *
 * Handles exporting Configuration as JSON files and importing/validating
 * Configuration from JSON files.
 *
 * Like `storage.ts`, this is a form boundary (TICKET-REF-01): an exported file carries
 * **id-resolved** references so it survives renames on either side of the exchange, and an
 * imported one comes back in **display form**.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
 */

import {
  ensureReferenceIds,
  toDisplayConfiguration,
  toStoredConfiguration,
} from '../engine/formula/references';
import type { Configuration } from '../types/config';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import { readStoredSnapshot } from './storage';

/**
 * Import/Export error types
 */
export class ImportExportError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ImportExportError';
  }
}

export class ValidationError extends ImportExportError {
  constructor(
    message: string,
    public readonly errors: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * A file written against a persisted shape this build does not read (TICKET-IO-03)
 *
 * Deliberately **not** a `ValidationError`: "this file is from the old app" and "this file is
 * malformed" are different problems with different answers, and a User handed a list of thirty
 * missing-field complaints would reasonably conclude their export was corrupt. Thrown before
 * validation runs, so nothing else is reported about a file that was never going to apply.
 */
export class SchemaVersionError extends ImportExportError {
  constructor(
    message: string,
    /** What the file said it was, or undefined when it said nothing */
    public readonly foundVersion?: unknown
  ) {
    super(message);
    this.name = 'SchemaVersionError';
  }
}

/**
 * Validation result for imported configuration
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Export configuration as JSON file
 *
 * Creates a downloadable JSON file with the configuration data.
 * The file is named based on the configuration name and timestamp.
 *
 * @param config Configuration to export
 * @returns Blob containing the JSON data
 */
export function exportConfiguration(config: Configuration): Blob {
  try {
    const json = JSON.stringify(toStoredConfiguration(config), null, 2);
    return new Blob([json], { type: 'application/json' });
  } catch (error) {
    throw new ImportExportError('Failed to export configuration', error);
  }
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
 * Validate an optional numeric field
 *
 * Absent is valid — that is what makes a field optional, and it is how a file exported before
 * the field existed stays importable.
 *
 * @param value The field's value, possibly undefined
 * @param field The field name, for the error message
 * @returns An error message, or null when the value is acceptable
 */
function validateOptionalNonNegativeNumber(value: unknown, field: string): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'number' || value < 0) {
    return `Field '${field}' must be a number of 0 or more when present`;
  }
  return null;
}

/** What a name a formula spells must look like — shared by constants and curve columns */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

/** The enum values a curve's three modes accept (Concept 06) */
const CURVE_MODES = {
  interpolation: ['step', 'linear'],
  outOfRange: ['clamp', 'extrapolate', 'error'],
  lookupDirection: ['forward', 'reverse'],
} as const;

/**
 * Shape errors for one curve of an imported configuration
 *
 * Structure only — that the fields exist and hold the right kinds of thing. Whether the *rows*
 * make a readable table (sorted, unique keys, the right number of values) is
 * `engine/validator.ts`'s report, because a curve can be structurally fine and still be a table
 * nobody can look anything up in.
 *
 * @param curve - One element of `config.curves`
 * @param index - Its position, for the message
 * @param seenNames - Names already used, mutated as each is accepted
 * @returns The errors found, empty when the shape is sound
 */
function curveShapeErrors(
  curve: Record<string, unknown>,
  index: number,
  seenNames: Set<string>
): string[] {
  const errors: string[] = [];

  if (typeof curve.name !== 'string' || !IDENTIFIER_PATTERN.test(curve.name)) {
    errors.push(`curves[${index}].name must be a lowercase identifier`);
  } else if (seenNames.has(curve.name)) {
    // A duplicate splits identity from behaviour: a stored formula points at one curve's id
    // while the resolver reads the other's table (the `constants` rule, same reason)
    errors.push(`curves[${index}].name must be unique`);
  } else {
    seenNames.add(curve.name);
  }

  if (typeof curve.displayName !== 'string') {
    errors.push(`curves[${index}].displayName must be a string`);
  }

  // Both are required by the type, so a file missing either imports and then renders a report
  // reading `…has more than one row for undefined 3`
  if (typeof curve.description !== 'string') {
    errors.push(`curves[${index}].description must be a string`);
  }
  if (typeof curve.keyName !== 'string' || curve.keyName.length === 0) {
    errors.push(`curves[${index}].keyName is required`);
  }

  for (const [field, allowed] of Object.entries(CURVE_MODES)) {
    if (!(allowed as readonly string[]).includes(curve[field] as string)) {
      errors.push(`curves[${index}].${field} must be one of: ${allowed.join(', ')}`);
    }
  }

  if (!Array.isArray(curve.columns) || curve.columns.length === 0) {
    errors.push(`curves[${index}].columns must be a non-empty array`);
  } else if (
    curve.columns.some((column: unknown) => {
      if (!column || typeof column !== 'object') return true;
      // A column name is a formula segment now — `curve.point_buy.main_type(3)` — so a column
      // called `Main Type` would be unreachable from any formula and unnameable in an error
      const name = (column as Record<string, unknown>).name;
      return typeof name !== 'string' || !IDENTIFIER_PATTERN.test(name);
    })
  ) {
    errors.push(`curves[${index}].columns entries must each have a lowercase identifier name`);
  } else if (
    curve.columns.some((column: unknown) => {
      const generator = (column as Record<string, unknown>).generator;
      return generator !== undefined && typeof generator !== 'string';
    })
  ) {
    // Absent is valid — a hand-entered column has no generator (TICKET-CRV-02). Whether a present
    // one *evaluates* is `engine/validator.ts`'s report, like every other formula.
    errors.push(`curves[${index}].columns generators must be strings when present`);
  }

  const columnCount = Array.isArray(curve.columns) ? curve.columns.length : 0;
  if (!Array.isArray(curve.rows)) {
    errors.push(`curves[${index}].rows must be an array`);
  } else if (
    curve.rows.some((row: unknown) => {
      if (!row || typeof row !== 'object') return true;
      const candidate = row as Record<string, unknown>;
      return (
        typeof candidate.key !== 'number' ||
        !Array.isArray(candidate.values) ||
        candidate.values.length !== columnCount ||
        candidate.values.some((value: unknown) => typeof value !== 'number')
      );
    })
  ) {
    errors.push(`curves[${index}].rows entries must have a numeric key and one value per column`);
  } else if (
    curve.rows.some((row: unknown) => {
      // Absent is valid and means "nothing overridden", which is how a curve written before
      // TICKET-CRV-02 loads unchanged
      const flags = (row as Record<string, unknown>).overridden;
      return (
        flags !== undefined &&
        (!Array.isArray(flags) ||
          // Shorter is sanctioned — a missing flag reads as false. Longer flags a cell that does
          // not exist, and `withCell` would silently drop it.
          flags.length > columnCount ||
          flags.some((flag: unknown) => typeof flag !== 'boolean'))
      );
    })
  ) {
    errors.push(
      `curves[${index}].rows overridden must be an array of booleans, one per column at most`
    );
  }

  return errors;
}

/**
 * Validate configuration structure
 *
 * Checks that the imported data has all required fields and correct types.
 *
 * The **version** is not checked here — `importConfiguration` gates on it first (TICKET-IO-03), so
 * by the time this runs the file has already claimed to be the current shape and every error it
 * reports is a real structural one.
 *
 * One deliberate exemption: a skill's `id` is required by the type but **not** checked here, so
 * files exported before TICKET-REF-01 still import — `ensureReferenceIds` mints the missing ones
 * on the way through `importConfiguration`.
 *
 * @param data Unknown data to validate
 * @returns Validation result with errors if any
 */
export function validateConfiguration(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, errors: ['Configuration must be an object'] };
  }

  const config = data as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ['id', 'name', 'version', 'createdAt', 'updatedAt'];
  for (const field of requiredStrings) {
    if (typeof config[field] !== 'string') {
      errors.push(`Field '${field}' must be a string`);
    }
  }

  // Required number fields
  if (typeof config.focusStatBonusLevel !== 'number') {
    errors.push("Field 'focusStatBonusLevel' must be a number");
  }

  // Optional number fields — absent is valid, so files predating the field still import
  const budgetError = validateOptionalNonNegativeNumber(
    config.mainSkillPointBudget,
    'mainSkillPointBudget'
  );
  if (budgetError) {
    errors.push(budgetError);
  }

  // Required array fields
  const requiredArrays = [
    'stats',
    'skills',
    'combatSkills',
    'materials',
    'materialCategories',
    'items',
    'equipmentSlots',
    'races',
    'currencyTiers',
  ];

  for (const field of requiredArrays) {
    if (!Array.isArray(config[field])) {
      errors.push(`Field '${field}' must be an array`);
    }
  }

  // Validate stats structure
  const seenAbbreviations = new Set<string>();
  if (Array.isArray(config.stats)) {
    config.stats.forEach((stat: unknown, index: number) => {
      if (!stat || typeof stat !== 'object') {
        errors.push(`stats[${index}] must be an object`);
        return;
      }
      const s = stat as Record<string, unknown>;
      if (typeof s.id !== 'string') {
        errors.push(`stats[${index}].id must be a string`);
      }
      if (typeof s.name !== 'string') {
        errors.push(`stats[${index}].name must be a string`);
      }
      // An abbreviation is a formula spelling in the flat space shared with the skill codes
      // (TICKET-STAT-01), so it has to be identifier-shaped and unique against every one of them
      if (typeof s.abbreviation !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(s.abbreviation)) {
        errors.push(`stats[${index}].abbreviation must be an uppercase identifier`);
      } else if (seenAbbreviations.has(s.abbreviation)) {
        errors.push(`stats[${index}].abbreviation must be unique`);
      } else {
        seenAbbreviations.add(s.abbreviation);
      }
      if (typeof s.order !== 'number') {
        errors.push(`stats[${index}].order must be a number`);
      }
      if (typeof s.countsTowardTotal !== 'boolean') {
        errors.push(`stats[${index}].countsTowardTotal must be a boolean`);
      }
      if (typeof s.isResource !== 'boolean') {
        errors.push(`stats[${index}].isResource must be a boolean`);
      }
      // Absent is the invested case; present makes the stat derived
      if (s.formula !== undefined && typeof s.formula !== 'string') {
        errors.push(`stats[${index}].formula must be a string when present`);
      }
      if (!['none', 'nearest', 'up', 'down'].includes(s.rounding as string)) {
        errors.push(`stats[${index}].rounding must be one of: none, nearest, up, down`);
      }
    });
  }

  // Validate race stat blocks (TICKET-RACE-01). A race is `{ id, name, description, statValues }`
  // where `statValues` maps stat **id** to an absolute number — an absent stat reads 0, so the
  // record may be empty, but a present entry has to be a real number rather than a string.
  if (Array.isArray(config.races)) {
    config.races.forEach((race: unknown, index: number) => {
      if (!race || typeof race !== 'object') {
        errors.push(`races[${index}] must be an object`);
        return;
      }
      const r = race as Record<string, unknown>;
      if (typeof r.id !== 'string') {
        errors.push(`races[${index}].id must be a string`);
      }
      if (typeof r.name !== 'string') {
        errors.push(`races[${index}].name must be a string`);
      }
      if (!r.statValues || typeof r.statValues !== 'object' || Array.isArray(r.statValues)) {
        errors.push(`races[${index}].statValues must be an object keyed by stat id`);
        return;
      }
      for (const [statId, value] of Object.entries(r.statValues as Record<string, unknown>)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`races[${index}].statValues.${statId} must be a finite number`);
        }
      }
    });
  }

  // Validate material tier modifiers (TICKET-MAT-01). A tier bonus is `{ statId, modifier }` —
  // keyed by stat **id**, like a race's stat block, so a file still holding the old
  // `{ skillCode, modifier }` shape is reported here by name rather than silently importing as a
  // list of modifiers that target nothing.
  if (Array.isArray(config.materials)) {
    config.materials.forEach((material: unknown, index: number) => {
      if (!material || typeof material !== 'object') {
        errors.push(`materials[${index}] must be an object`);
        return;
      }
      const m = material as Record<string, unknown>;
      if (!Array.isArray(m.levels)) {
        errors.push(`materials[${index}].levels must be an array`);
        return;
      }

      m.levels.forEach((level: unknown, levelIndex: number) => {
        const where = `materials[${index}].levels[${levelIndex}]`;
        if (!level || typeof level !== 'object') {
          errors.push(`${where} must be an object`);
          return;
        }
        const l = level as Record<string, unknown>;
        if (!Array.isArray(l.bonuses)) {
          errors.push(`${where}.bonuses must be an array`);
          return;
        }

        l.bonuses.forEach((bonus: unknown, bonusIndex: number) => {
          const at = `${where}.bonuses[${bonusIndex}]`;
          if (!bonus || typeof bonus !== 'object') {
            errors.push(`${at} must be an object`);
            return;
          }
          const b = bonus as Record<string, unknown>;
          if (typeof b.statId !== 'string' || b.statId === '') {
            errors.push(`${at}.statId must be a stat id`);
          }
          if (typeof b.modifier !== 'number' || !Number.isFinite(b.modifier)) {
            errors.push(`${at}.modifier must be a finite number`);
          }
        });
      });
    });
  }

  // Validate skills structure (Concept 02, TICKET-SKL-02). A skill is `{ id, name, description,
  // statWeights }` — weight rows keyed by stat **id**, so a file still holding a `bonusFormula`
  // and a `code` is reported by name here rather than importing as a skill derived from nothing.
  if (Array.isArray(config.skills)) {
    config.skills.forEach((skill: unknown, index: number) => {
      if (!skill || typeof skill !== 'object') {
        errors.push(`skills[${index}] must be an object`);
        return;
      }
      const s = skill as Record<string, unknown>;
      if (typeof s.id !== 'string') {
        errors.push(`skills[${index}].id must be a string`);
      }
      if (typeof s.name !== 'string') {
        errors.push(`skills[${index}].name must be a string`);
      }
      if (!Array.isArray(s.statWeights)) {
        errors.push(`skills[${index}].statWeights must be an array`);
        return;
      }

      s.statWeights.forEach((row: unknown, rowIndex: number) => {
        const at = `skills[${index}].statWeights[${rowIndex}]`;
        if (!row || typeof row !== 'object') {
          errors.push(`${at} must be an object`);
          return;
        }
        const w = row as Record<string, unknown>;
        if (typeof w.statId !== 'string' || w.statId === '') {
          errors.push(`${at}.statId must be a stat id`);
        }
        if (typeof w.weight !== 'number' || !Number.isFinite(w.weight)) {
          errors.push(`${at}.weight must be a finite number`);
        }
      });
    });
  }

  // Validate combat skills structure
  if (Array.isArray(config.combatSkills)) {
    config.combatSkills.forEach((skill: unknown, index: number) => {
      if (!skill || typeof skill !== 'object') {
        errors.push(`combatSkills[${index}] must be an object`);
        return;
      }
      const s = skill as Record<string, unknown>;
      if (typeof s.code !== 'string' || s.code.length !== 3) {
        errors.push(`combatSkills[${index}].code must be a 3-letter string`);
      }
      if (typeof s.name !== 'string') {
        errors.push(`combatSkills[${index}].name must be a string`);
      }
      if (!s.dice || typeof s.dice !== 'object') {
        errors.push(`combatSkills[${index}].dice must be an object`);
      }
      if (typeof s.bonusFormula !== 'string') {
        errors.push(`combatSkills[${index}].bonusFormula must be a string`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Import configuration from JSON string
 *
 * Parses and validates JSON string, returning a Configuration object.
 *
 * The version gate runs **before** validation and before anything is applied: a file from the
 * old app is refused whole, with its own message, rather than reported field by field
 * (TICKET-IO-03).
 *
 * @param json JSON string to parse
 * @returns Parsed and validated Configuration
 * @throws {SchemaVersionError} If the file was written against another persisted shape
 * @throws {ValidationError} If validation fails
 * @throws {ImportExportError} If parsing fails
 */
export function importConfiguration(json: string): Configuration {
  try {
    const data = JSON.parse(json);

    const found = (data as Record<string, unknown> | null)?.schemaVersion;
    if (found !== SUPPORTED_SCHEMA_VERSION) {
      throw new SchemaVersionError(
        'This file was exported by an older version of the app and cannot be imported. Its ' +
          'stats, skills and characters have no faithful place in the current model. Keep the ' +
          'file — nothing here has changed — and rebuild the ruleset, or export it again from a ' +
          'build that understands it.',
        found
      );
    }

    const validation = validateConfiguration(data);

    if (!validation.isValid) {
      throw new ValidationError('Configuration validation failed', validation.errors);
    }

    return toDisplayConfiguration(
      ensureReferenceIds(data as Configuration, () => crypto.randomUUID())
    );
  } catch (error) {
    if (error instanceof ValidationError || error instanceof SchemaVersionError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ImportExportError('Invalid JSON format', error);
    }
    throw new ImportExportError('Failed to import configuration', error);
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
