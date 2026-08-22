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
import { ROLL_CATEGORIES, STAT_AFFINITIES, SUPPORTED_SCHEMA_VERSION } from '../types/config';
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
 * Fields a previous shape carried that this one no longer has, and what replaced each
 *
 * Reported as errors rather than ignored, for TICKET-IO-03's reason: a file carrying a retired
 * field was authored against rules this build no longer applies, and silently dropping it would
 * import a ruleset that plays differently from the one the User exported. Naming the replacement
 * is the difference between "your file is wrong" and "here is where that number went now".
 */
const RETIRED_FIELDS: Record<string, string> = {
  mainSkillPointBudget:
    "the point budget is now derived as level × const.points_per_level, so set the 'points_per_level' constant instead (TICKET-RES-02)",
  focusStatBonusLevel:
    'the focus stat is retired — an Archetype tags every stat main/sub/non and routes a spent point through the matching point_buy column, which is what replaced the flat bonus (TICKET-ARC-03)',
  combatSkills:
    "combat skills are retired — a roll is a 'rollDefinitions' entry now, an input formula fed down a dice ladder rather than a hand-typed pool with a bonus bolted on, so rebuild each one under Rolls (TICKET-ROLL-06)",
};

/**
 * Errors for any retired field the imported configuration still carries
 *
 * @param config The parsed configuration object
 * @returns One error per retired field present, empty when the file is on the current shape
 */
function retiredFieldErrors(config: Record<string, unknown>): string[] {
  return Object.entries(RETIRED_FIELDS)
    .filter(([field]) => config[field] !== undefined)
    .map(
      ([field, replacement]) =>
        `Field '${field}' is no longer part of a configuration — ${replacement}`
    );
}

/** What a name a formula spells must look like — shared by constants and curve columns */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

/** The affinity values an archetype may tag a stat with (Concept 03) */
const AFFINITY_VALUES = new Set<string>(STAT_AFFINITIES);

/** The categories a roll may be sorted into (Concept 08) */
const ROLL_CATEGORY_VALUES = new Set<string>(ROLL_CATEGORIES);

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
 * Shape errors for one dice ladder of an imported configuration (Concept 07, TICKET-ROLL-03)
 *
 * Structure only, extracted for the same reason `curveShapeErrors` is: whether the sizes make a
 * *walkable* ladder — descending, positive, with a usable cap — is `engine/validator.ts`'s report,
 * because a ladder can be structurally fine and still decompose in an order nobody expected.
 *
 * @param ladder - One element of `config.diceLadders`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function diceLadderShapeErrors(ladder: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof ladder.id !== 'string' || ladder.id === '') {
    errors.push(`diceLadders[${index}].id must be a non-empty string`);
  }

  // Free text rather than an identifier: a ladder is reached by id from a roll definition, never
  // spelled in a formula
  if (typeof ladder.name !== 'string') {
    errors.push(`diceLadders[${index}].name must be a string`);
  }
  if (typeof ladder.description !== 'string') {
    errors.push(`diceLadders[${index}].description must be a string`);
  }

  if (
    !Array.isArray(ladder.dieSizes) ||
    ladder.dieSizes.some((size: unknown) => typeof size !== 'number' || !Number.isFinite(size))
  ) {
    errors.push(`diceLadders[${index}].dieSizes must be an array of numbers`);
  }

  // Absent is valid and means no cap — the field only exists to express one
  if (
    ladder.maxPerDie !== undefined &&
    (typeof ladder.maxPerDie !== 'number' || !Number.isFinite(ladder.maxPerDie))
  ) {
    errors.push(`diceLadders[${index}].maxPerDie must be a finite number when present`);
  }

  if (typeof ladder.showZeroTerms !== 'boolean') {
    errors.push(`diceLadders[${index}].showZeroTerms must be a boolean`);
  }

  // An enum of one (TICKET-ROLL-03's notes), so a file claiming `smallest_die` was written against
  // rules this build does not have and is refused rather than silently decomposing as `flat`
  if (ladder.remainder !== 'flat') {
    errors.push(`diceLadders[${index}].remainder must be 'flat'`);
  }

  return errors;
}

/**
 * Shape errors for one roll definition of an imported configuration (Concept 08, TICKET-ROLL-05)
 *
 * Structure only. Whether the `input` *computes* and whether `ladderId` names a ladder that exists
 * are `engine/validator.ts`'s report, for the reason every other entity here has one: a roll can be
 * structurally perfect and still point at a ladder somebody deleted.
 *
 * @param roll - One element of `config.rollDefinitions`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function rollDefinitionShapeErrors(roll: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof roll.id !== 'string' || roll.id === '') {
    errors.push(`rollDefinitions[${index}].id must be a non-empty string`);
  }
  if (typeof roll.name !== 'string') {
    errors.push(`rollDefinitions[${index}].name must be a string`);
  }
  if (typeof roll.description !== 'string') {
    errors.push(`rollDefinitions[${index}].description must be a string`);
  }
  if (typeof roll.input !== 'string') {
    errors.push(`rollDefinitions[${index}].input must be a formula string`);
  }
  // Required, unlike most references here: a roll with no ladder has nothing to decompose with,
  // so there is no sensible default to fall back to
  if (typeof roll.ladderId !== 'string' || roll.ladderId === '') {
    errors.push(`rollDefinitions[${index}].ladderId must be a dice ladder id`);
  }
  if (typeof roll.order !== 'number') {
    errors.push(`rollDefinitions[${index}].order must be a number`);
  }
  // Absent is valid — a ruleset may decline to sort its rolls at all (Concept 08)
  if (roll.category !== undefined && !ROLL_CATEGORY_VALUES.has(roll.category as string)) {
    errors.push(
      `rollDefinitions[${index}].category must be one of ${[...ROLL_CATEGORY_VALUES].join(', ')} when present`
    );
  }

  return errors;
}

/**
 * Shape errors for one item of an imported configuration
 *
 * Every reference is optional — an item may be plain — but a *present* one has to be a string, or
 * the reference checks in `engine/validator.ts` compare a number against a set of ids and report
 * nothing.
 *
 * @param item - One element of `config.items`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function itemShapeErrors(item: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof item.id !== 'string' || item.id === '') {
    errors.push(`items[${index}].id must be a non-empty string`);
  }
  if (typeof item.name !== 'string') {
    errors.push(`items[${index}].name must be a string`);
  }
  if (typeof item.description !== 'string') {
    errors.push(`items[${index}].description must be a string`);
  }

  for (const field of ['categoryId', 'materialId', 'equipmentSlotType']) {
    if (item[field] !== undefined && typeof item[field] !== 'string') {
      errors.push(`items[${index}].${field} must be a string when present`);
    }
  }

  if (
    item.materialLevel !== undefined &&
    (typeof item.materialLevel !== 'number' || !Number.isFinite(item.materialLevel))
  ) {
    errors.push(`items[${index}].materialLevel must be a finite number when present`);
  }

  return errors;
}

/**
 * Shape errors for one equipment slot of an imported configuration
 *
 * A slot is identified by its `type` rather than by an id — that is the string an item names —
 * so an empty one is a slot nothing can ever be equipped to.
 *
 * @param slot - One element of `config.equipmentSlots`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function equipmentSlotShapeErrors(slot: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof slot.type !== 'string' || slot.type === '') {
    errors.push(`equipmentSlots[${index}].type must be a non-empty string`);
  }
  if (typeof slot.name !== 'string') {
    errors.push(`equipmentSlots[${index}].name must be a string`);
  }
  if (typeof slot.description !== 'string') {
    errors.push(`equipmentSlots[${index}].description must be a string`);
  }

  return errors;
}

/**
 * Shape errors for one currency tier of an imported configuration
 *
 * `order` places the tier on the conversion ladder and `conversionToNext` is how many of it make
 * one of the next — both have to be finite numbers for the ladder to be walkable at all. Whether
 * the orders are unique and gapless is `engine/validator.ts`'s report.
 *
 * @param tier - One element of `config.currencyTiers`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function currencyTierShapeErrors(tier: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof tier.id !== 'string' || tier.id === '') {
    errors.push(`currencyTiers[${index}].id must be a non-empty string`);
  }
  if (typeof tier.name !== 'string') {
    errors.push(`currencyTiers[${index}].name must be a string`);
  }
  if (typeof tier.order !== 'number' || !Number.isFinite(tier.order)) {
    errors.push(`currencyTiers[${index}].order must be a finite number`);
  }
  if (typeof tier.conversionToNext !== 'number' || !Number.isFinite(tier.conversionToNext)) {
    errors.push(`currencyTiers[${index}].conversionToNext must be a finite number`);
  }

  return errors;
}

/**
 * Shape errors for one material category of an imported configuration
 *
 * @param category - One element of `config.materialCategories`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function materialCategoryShapeErrors(category: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof category.id !== 'string' || category.id === '') {
    errors.push(`materialCategories[${index}].id must be a non-empty string`);
  }
  if (typeof category.name !== 'string') {
    errors.push(`materialCategories[${index}].name must be a string`);
  }
  if (typeof category.description !== 'string') {
    errors.push(`materialCategories[${index}].description must be a string`);
  }

  return errors;
}

/**
 * Shape errors for one material of an imported configuration (Concept 09, TICKET-MAT-01)
 *
 * A tier bonus is `{ statId, modifier }` — keyed by stat **id**, like a race's stat block, so a
 * file still holding the old `{ skillCode, modifier }` shape is reported here by name rather than
 * silently importing as a list of modifiers that target nothing. A tier's `value` is the price the
 * material sells at, and its `tierId` is what `engine/validator.ts` resolves against the currency
 * ladder — so an absent one is a shape error here rather than a crash there (CR-03).
 *
 * @param material - One element of `config.materials`
 * @param index - Its position, for the message
 * @returns The errors found, empty when the shape is sound
 */
function materialShapeErrors(material: Record<string, unknown>, index: number): string[] {
  const errors: string[] = [];

  if (typeof material.id !== 'string' || material.id === '') {
    errors.push(`materials[${index}].id must be a non-empty string`);
  }
  if (typeof material.name !== 'string') {
    errors.push(`materials[${index}].name must be a string`);
  }
  if (typeof material.description !== 'string') {
    errors.push(`materials[${index}].description must be a string`);
  }
  if (typeof material.categoryId !== 'string' || material.categoryId === '') {
    errors.push(`materials[${index}].categoryId must be a material category id`);
  }

  if (!Array.isArray(material.levels)) {
    errors.push(`materials[${index}].levels must be an array`);
    return errors;
  }

  material.levels.forEach((level: unknown, levelIndex: number) => {
    const where = `materials[${index}].levels[${levelIndex}]`;
    if (!level || typeof level !== 'object') {
      errors.push(`${where} must be an object`);
      return;
    }
    const l = level as Record<string, unknown>;

    if (typeof l.level !== 'number' || !Number.isFinite(l.level)) {
      errors.push(`${where}.level must be a finite number`);
    }
    if (typeof l.name !== 'string') {
      errors.push(`${where}.name must be a string`);
    }

    if (!l.value || typeof l.value !== 'object' || Array.isArray(l.value)) {
      errors.push(`${where}.value must be a { tierId, amount } object`);
    } else {
      const v = l.value as Record<string, unknown>;
      if (typeof v.tierId !== 'string' || v.tierId === '') {
        errors.push(`${where}.value.tierId must be a currency tier id`);
      }
      if (typeof v.amount !== 'number' || !Number.isFinite(v.amount)) {
        errors.push(`${where}.value.amount must be a finite number`);
      }
    }

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

  return errors;
}

/**
 * Run a per-entry shape check across one of the configuration's collections
 *
 * Every collection had this same three-line preamble — "is it an array, is each entry an object,
 * then check the entry" — and four of them had *only* the first line (CR-03). Sharing it is what
 * makes adding a collection without its entry check the visible omission it should be.
 *
 * @param entries - The collection, already known to be an array
 * @param field - The collection's name, for the message
 * @param shapeErrors - The per-entry check
 * @returns Every error across the collection
 */
function collectionShapeErrors(
  entries: unknown[],
  field: string,
  shapeErrors: (entry: Record<string, unknown>, index: number) => string[]
): string[] {
  return entries.flatMap((entry: unknown, index: number) =>
    !entry || typeof entry !== 'object'
      ? [`${field}[${index}] must be an object`]
      : shapeErrors(entry as Record<string, unknown>, index)
  );
}

/**
 * Validate configuration structure
 *
 * Checks that the imported data has all required fields and correct types.
 *
 * The `Shape` suffix is load-bearing (CR-21): `engine/validator.ts` exports a `validateConfiguration`
 * that answers the *other* half of the question — whether the references resolve, the formulas
 * evaluate and the tables read. This one only asks whether the untrusted JSON has the right fields
 * of the right types; the two are complementary and both run on an import.
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
export function validateConfigurationShape(data: unknown): ValidationResult {
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

  // A field a previous shape carried is a refusal, not something to ignore
  errors.push(...retiredFieldErrors(config));

  // Required array fields
  const requiredArrays = [
    'stats',
    'skills',
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

  // Validate archetypes (TICKET-ARC-01). Optional and absent-means-none, like `constants` and
  // `curves`, so only a present key is checked. `statAffinity` maps stat **id** to one of the three
  // affinity values, and is sparse by design: an absent stat is `non`.
  if (config.archetypes !== undefined) {
    if (!Array.isArray(config.archetypes)) {
      errors.push("Field 'archetypes' must be an array when present");
    } else {
      config.archetypes.forEach((archetype: unknown, index: number) => {
        if (!archetype || typeof archetype !== 'object') {
          errors.push(`archetypes[${index}] must be an object`);
          return;
        }
        const a = archetype as Record<string, unknown>;
        if (typeof a.id !== 'string') {
          errors.push(`archetypes[${index}].id must be a string`);
        }
        if (typeof a.name !== 'string') {
          errors.push(`archetypes[${index}].name must be a string`);
        }
        if (
          !a.statAffinity ||
          typeof a.statAffinity !== 'object' ||
          Array.isArray(a.statAffinity)
        ) {
          errors.push(`archetypes[${index}].statAffinity must be an object keyed by stat id`);
          return;
        }
        for (const [statId, affinity] of Object.entries(
          a.statAffinity as Record<string, unknown>
        )) {
          if (typeof affinity !== 'string' || !AFFINITY_VALUES.has(affinity)) {
            errors.push(
              `archetypes[${index}].statAffinity.${statId} must be one of ${[...AFFINITY_VALUES].join(', ')}`
            );
          }
        }
      });
    }
  }

  // The four collections whose entries used to be checked no further than `Array.isArray` (CR-03),
  // plus materials. A `{"currencyTiers":[null]}` file passed the shape gate on that omission and
  // then crashed `engine/validator.ts` — after `replaceConfig` had already persisted it.
  if (Array.isArray(config.materials)) {
    errors.push(...collectionShapeErrors(config.materials, 'materials', materialShapeErrors));
  }
  if (Array.isArray(config.materialCategories)) {
    errors.push(
      ...collectionShapeErrors(
        config.materialCategories,
        'materialCategories',
        materialCategoryShapeErrors
      )
    );
  }
  if (Array.isArray(config.items)) {
    errors.push(...collectionShapeErrors(config.items, 'items', itemShapeErrors));
  }
  if (Array.isArray(config.equipmentSlots)) {
    errors.push(
      ...collectionShapeErrors(config.equipmentSlots, 'equipmentSlots', equipmentSlotShapeErrors)
    );
  }
  if (Array.isArray(config.currencyTiers)) {
    errors.push(
      ...collectionShapeErrors(config.currencyTiers, 'currencyTiers', currencyTierShapeErrors)
    );
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
        if (typeof c.name !== 'string' || !IDENTIFIER_PATTERN.test(c.name)) {
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

  // Validate curves structure — absent is valid, so files predating TICKET-CRV-01 still import.
  // The row *contents* (sorted, unique keys) are `engine/validator.ts`'s job: a ruleset that
  // imports with a badly ordered curve is reportable, not unreadable.
  if (config.curves !== undefined) {
    if (!Array.isArray(config.curves)) {
      errors.push("Field 'curves' must be an array when present");
    } else {
      const seenNames = new Set<string>();
      config.curves.forEach((curve: unknown, index: number) => {
        if (!curve || typeof curve !== 'object') {
          errors.push(`curves[${index}] must be an object`);
          return;
        }
        errors.push(...curveShapeErrors(curve as Record<string, unknown>, index, seenNames));
      });
    }
  }

  // Validate dice ladders (Concept 07, TICKET-ROLL-03) — absent is valid, so files predating
  // ladders still import
  if (config.diceLadders !== undefined) {
    if (!Array.isArray(config.diceLadders)) {
      errors.push("Field 'diceLadders' must be an array when present");
    } else {
      errors.push(
        ...collectionShapeErrors(config.diceLadders, 'diceLadders', diceLadderShapeErrors)
      );
    }
  }

  // Validate roll definitions (Concept 08, TICKET-ROLL-05) — absent is valid, so files predating
  // rolls still import
  if (config.rollDefinitions !== undefined) {
    if (!Array.isArray(config.rollDefinitions)) {
      errors.push("Field 'rollDefinitions' must be an array when present");
    } else {
      errors.push(
        ...collectionShapeErrors(
          config.rollDefinitions,
          'rollDefinitions',
          rollDefinitionShapeErrors
        )
      );
    }
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

    const validation = validateConfigurationShape(data);

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
