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
 * Download configuration as JSON file
 *
 * Triggers a browser download of the configuration as a JSON file.
 *
 * @param config Configuration to download
 * @param filename Optional custom filename (defaults to config name + timestamp)
 */
export function downloadConfiguration(config: Configuration, filename?: string): void {
  try {
    const blob = exportConfiguration(config);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const defaultFilename = `${config.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    link.href = url;
    link.download = filename || defaultFilename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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

/**
 * Validate configuration structure
 *
 * Checks that the imported data has all required fields and correct types.
 *
 * One deliberate exemption: a skill's `id` is required by the type but **not** checked here, so
 * files exported before TICKET-REF-01 still import — `ensureReferenceIds` mints the missing ones
 * on the way through `importConfiguration`. TICKET-IO-03 replaces the whole leniency with an
 * outright rejection of pre-v2 files.
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
    'mainSkills',
    'stats',
    'specialitySkills',
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

  // Validate main skills structure
  if (Array.isArray(config.mainSkills)) {
    config.mainSkills.forEach((skill: unknown, index: number) => {
      if (!skill || typeof skill !== 'object') {
        errors.push(`mainSkills[${index}] must be an object`);
        return;
      }
      const s = skill as Record<string, unknown>;
      if (typeof s.code !== 'string' || s.code.length !== 3) {
        errors.push(`mainSkills[${index}].code must be a 3-letter string`);
      }
      if (typeof s.name !== 'string') {
        errors.push(`mainSkills[${index}].name must be a string`);
      }
      if (typeof s.maxLevel !== 'number') {
        errors.push(`mainSkills[${index}].maxLevel must be a number`);
      }
    });
  }

  // Validate stats structure
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
      if (typeof s.formula !== 'string') {
        errors.push(`stats[${index}].formula must be a string`);
      }
    });
  }

  // Validate speciality skills structure
  if (Array.isArray(config.specialitySkills)) {
    config.specialitySkills.forEach((skill: unknown, index: number) => {
      if (!skill || typeof skill !== 'object') {
        errors.push(`specialitySkills[${index}] must be an object`);
        return;
      }
      const s = skill as Record<string, unknown>;
      if (typeof s.code !== 'string' || s.code.length !== 3) {
        errors.push(`specialitySkills[${index}].code must be a 3-letter string`);
      }
      if (typeof s.name !== 'string') {
        errors.push(`specialitySkills[${index}].name must be a string`);
      }
      if (typeof s.bonusFormula !== 'string') {
        errors.push(`specialitySkills[${index}].bonusFormula must be a string`);
      }
    });
  }

  // Validate constants structure — absent is valid, so files predating TICKET-CST-01 still
  // import. `id` is not required for the same reason skills' is not: `ensureReferenceIds` mints
  // a missing one on the way through `importConfiguration`.
  if (config.constants !== undefined) {
    if (!Array.isArray(config.constants)) {
      errors.push("Field 'constants' must be an array when present");
    } else {
      const seenNames = new Set<string>();
      config.constants.forEach((constant: unknown, index: number) => {
        if (!constant || typeof constant !== 'object') {
          errors.push(`constants[${index}] must be an object`);
          return;
        }
        const c = constant as Record<string, unknown>;
        if (typeof c.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(c.name)) {
          errors.push(`constants[${index}].name must be a lowercase identifier`);
        } else if (seenNames.has(c.name)) {
          // A duplicate splits identity from value: the stored formula points at one constant's
          // id while the resolver reads the other's number.
          errors.push(`constants[${index}].name must be unique`);
        } else {
          seenNames.add(c.name);
        }
        if (typeof c.displayName !== 'string') {
          errors.push(`constants[${index}].displayName must be a string`);
        }
        // Required by Concept 05 — a constant nobody understands is worse than a literal
        if (typeof c.description !== 'string' || c.description.length === 0) {
          errors.push(`constants[${index}].description is required`);
        }
        if (typeof c.value !== 'number') {
          errors.push(`constants[${index}].value must be a number`);
        }
      });
    }
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
 * @param json JSON string to parse
 * @returns Parsed and validated Configuration
 * @throws {ValidationError} If validation fails
 * @throws {ImportExportError} If parsing fails
 */
export function importConfiguration(json: string): Configuration {
  try {
    const data = JSON.parse(json);
    const validation = validateConfiguration(data);

    if (!validation.isValid) {
      throw new ValidationError('Configuration validation failed', validation.errors);
    }

    return toDisplayConfiguration(
      ensureReferenceIds(data as Configuration, () => crypto.randomUUID())
    );
  } catch (error) {
    if (error instanceof ValidationError) {
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
