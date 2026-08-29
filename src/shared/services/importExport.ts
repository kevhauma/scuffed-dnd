/**
 * Import/Export Service — the pure half
 *
 * Serialising a Configuration to JSON text, and parsing, version-gating and validating one that
 * comes back. Nothing here touches a browser API, which is what lets the server reuse it verbatim
 * (TICKET-DX-07, D5): the browser-file half — `Blob`, the download anchor and `File` reading —
 * lives in `client/services/configFiles.ts` and calls into this module.
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
import {
  GLYPH_NAMES,
  MAX_EQUIPMENT_GRID_COLUMNS,
  MAX_EQUIPMENT_GRID_ROWS,
  ROLL_CATEGORIES,
  STAT_AFFINITIES,
  SUPPORTED_SCHEMA_VERSION,
} from '../types/config';

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
 * Refuse a document written against a persisted shape this build does not read (TICKET-RUL-01)
 *
 * **One gate, so there is one message.** v3 Req 33.4 asks the server to reject a Ruleset whose
 * `schemaVersion` is not the supported one *with the version stated*, and RUL-01's criterion adds
 * "reusing the import path's message rather than a new one". A second copy of these four sentences
 * in `src/server/` would be a second thing to bring forward at the next bump — and the two would
 * disagree in front of a User who had opened the same file two ways.
 *
 * Extracted from {@link importConfiguration} rather than written beside it, so the browser import
 * and the server write are provably the same refusal.
 *
 * @param found What the document claims to be, or `undefined` when it claims nothing
 * @throws {SchemaVersionError} When it is anything other than `SUPPORTED_SCHEMA_VERSION`
 */
export function assertSupportedSchemaVersion(found: unknown): void {
  if (found === SUPPORTED_SCHEMA_VERSION) return;

  throw new SchemaVersionError(
    'This file was exported by an older version of the app and cannot be imported. Its ' +
      'stats, skills and characters have no faithful place in the current model. Keep the ' +
      'file — nothing here has changed — and rebuild the ruleset, or export it again from a ' +
      'build that understands it.',
    found
  );
}

/**
 * Serialise a configuration to the JSON text an export file carries
 *
 * The whole of what "exporting" means once the browser is taken out of it: references resolved to
 * ids, two-space indentation, and a `ImportExportError` around anything that will not stringify.
 * `client/services/configFiles.ts` wraps the result in a `Blob`; the server writes it to a column.
 *
 * @param config Configuration to serialise
 * @returns The JSON text of the configuration in stored form
 */
export function serializeConfiguration(config: Configuration): string {
  try {
    return JSON.stringify(toStoredConfiguration(config), null, 2);
  } catch (error) {
    throw new ImportExportError('Failed to export configuration', error);
  }
}

/**
 * Fields a previous shape carried that this one no longer has, and what replaced each
 *
 * Reported as errors rather than ignored, for TICKET-IO-03's reason: a file carrying a retired
 * field was authored against rules this build no longer applies, and silently dropping it would
 * import a ruleset that plays differently from the one the User exported. Naming the replacement
 * is the difference between "your file is wrong" and "here is where that number went now".
 *
 * These are the **configuration's own** keys. A field retired from an *entity* is recorded on that
 * collection's {@link EntitySpec.retired} instead, so the retirement sits beside the fields that
 * replaced it and is walked by the checker that was already walking the entries.
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

/**
 * Errors for any retired field one entity still carries
 *
 * {@link retiredFieldErrors}' sentence, one entity kind down, so a file whose items still fuse a
 * material tier is told where that pair went rather than reading a bare unknown-field silence.
 * Phrased with the path so the User can find the row.
 *
 * @param record The entry as it arrived
 * @param path Where it sits — `items[2]`
 * @param retired The collection's retired fields and their replacements
 * @returns One error per retired field present on this entry
 */
function retiredEntityFieldErrors(
  record: Record<string, unknown>,
  path: string,
  retired: Record<string, string>
): string[] {
  return Object.entries(retired)
    .filter(([field]) => record[field] !== undefined)
    .map(([field, replacement]) => `${path}.${field} is no longer a field — ${replacement}`);
}

/** What a name a formula spells must look like — shared by constants and curve columns */
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;

/** What a stat's abbreviation must look like — the flat formula space is uppercase */
const ABBREVIATION_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** The affinity values an archetype may tag a stat with (Concept 03) */
const AFFINITY_VALUES = new Set<string>(STAT_AFFINITIES);

/** The categories a roll may be sorted into (Concept 08) */
const ROLL_CATEGORY_VALUES = new Set<string>(ROLL_CATEGORIES);

/**
 * One field's rule: the errors it finds at `path`, empty when the value is acceptable
 *
 * A function rather than a `{ type, required }` record (CR-22) because the *messages* are the
 * interesting part — "must be a dice ladder id" says more than "must be a string", and a table of
 * type names could not carry that. The constructors below are what keeps each entry declarative.
 */
type FieldRule = (value: unknown, path: string) => string[];

const isText = (value: unknown): boolean => typeof value === 'string';
const isNonEmptyText = (value: unknown): boolean => typeof value === 'string' && value !== '';
const isNumber = (value: unknown): boolean => typeof value === 'number';
const isFiniteNumber = (value: unknown): boolean =>
  typeof value === 'number' && Number.isFinite(value);
const isFlag = (value: unknown): boolean => typeof value === 'boolean';

/**
 * A rule from a predicate and the phrase completing `<path> …`
 *
 * @param accepts - Whether the value is acceptable
 * @param message - The phrase after the path — "must be a string"
 */
function must(accepts: (value: unknown) => boolean, message: string): FieldRule {
  return (value, path) => (accepts(value) ? [] : [`${path} ${message}`]);
}

/**
 * The same, but an absent value is acceptable
 *
 * Absence is meaningful across the model — an item may be plain, a ladder may have no cap — so
 * this is the common case rather than an exception.
 */
function mayBe(accepts: (value: unknown) => boolean, message: string): FieldRule {
  return (value, path) => (value === undefined || accepts(value) ? [] : [`${path} ${message}`]);
}

/** A value drawn from a closed set */
function oneOf(values: Iterable<string>, message: string): FieldRule {
  const allowed = new Set(values);
  return must((value) => typeof value === 'string' && allowed.has(value), message);
}

/** An array whose every element is acceptable */
function listOf(accepts: (value: unknown) => boolean, message: string): FieldRule {
  return must((value) => Array.isArray(value) && value.every(accepts), message);
}

/**
 * A record keyed by entity id, whose values are all acceptable
 *
 * Two messages, because the two failures read differently: the container being the wrong kind of
 * thing, and one entry in it being wrong — which is named by its key, so a User can find it.
 */
function recordOf(
  accepts: (value: unknown) => boolean,
  containerMessage: string,
  valueMessage: string
): FieldRule {
  return (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return [`${path} ${containerMessage}`];
    }

    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => !accepts(entry))
      .map(([key]) => `${path}.${key} ${valueMessage}`);
  };
}

/** The enum values a curve's three modes accept (Concept 06) */
const CURVE_MODES = {
  interpolation: ['step', 'linear'],
  outOfRange: ['clamp', 'extrapolate', 'error'],
  lookupDirection: ['forward', 'reverse'],
} as const;

/**
 * A curve's columns and rows — the part of its shape a field table cannot express
 *
 * The rules here are the genuinely cross-field ones (CR-22): a row's `values` has to be as long as
 * the column list, and its `overridden` flags no longer than it. Everything a curve has that is
 * just "this field holds this kind of thing" is a row in `ENTITY_SPECS` instead.
 *
 * Structure only — whether the *rows* make a readable table (sorted, unique keys) is
 * `engine/validator.ts`'s report, because a curve can be structurally fine and still be a table
 * nobody can look anything up in.
 *
 * @param curve - One element of `config.curves`
 * @param path - Where it sits, for the message — `curves[2]`
 * @returns The errors found, empty when the shape is sound
 */
function curveTableShapeErrors(curve: Record<string, unknown>, path: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(curve.columns) || curve.columns.length === 0) {
    errors.push(`${path}.columns must be a non-empty array`);
  } else if (
    curve.columns.some((column: unknown) => {
      if (!column || typeof column !== 'object') return true;
      // A column name is a formula segment now — `curve.point_buy.main_type(3)` — so a column
      // called `Main Type` would be unreachable from any formula and unnameable in an error
      const name = (column as Record<string, unknown>).name;
      return typeof name !== 'string' || !IDENTIFIER_PATTERN.test(name);
    })
  ) {
    errors.push(`${path}.columns entries must each have a lowercase identifier name`);
  } else if (
    curve.columns.some((column: unknown) => {
      const generator = (column as Record<string, unknown>).generator;
      return generator !== undefined && typeof generator !== 'string';
    })
  ) {
    // Absent is valid — a hand-entered column has no generator (TICKET-CRV-02). Whether a present
    // one *evaluates* is `engine/validator.ts`'s report, like every other formula.
    errors.push(`${path}.columns generators must be strings when present`);
  }

  const columnCount = Array.isArray(curve.columns) ? curve.columns.length : 0;
  if (!Array.isArray(curve.rows)) {
    errors.push(`${path}.rows must be an array`);
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
    errors.push(`${path}.rows entries must have a numeric key and one value per column`);
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
    errors.push(`${path}.rows overridden must be an array of booleans, one per column at most`);
  }

  return errors;
}

/**
 * A material's tier levels — the part of its shape a field table cannot express (CR-22)
 *
 * A tier bonus is `{ statId, modifier }` — keyed by stat **id**, like a race's stat block, so a
 * file still holding the old `{ skillCode, modifier }` shape is reported here by name rather than
 * silently importing as a list of modifiers that target nothing. A tier's `value` is the price the
 * material sells at, and its `tierId` is what `engine/validator.ts` resolves against the currency
 * ladder — so an absent one is a shape error here rather than a crash there (CR-03).
 *
 * @param material - One element of `config.materials`
 * @param path - Where it sits, for the message — `materials[2]`
 * @returns The errors found, empty when the shape is sound
 */
function materialLevelShapeErrors(material: Record<string, unknown>, path: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(material.levels)) {
    errors.push(`${path}.levels must be an array`);
    return errors;
  }

  material.levels.forEach((level: unknown, levelIndex: number) => {
    const where = `${path}.levels[${levelIndex}]`;
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
 * An inlay family's tiers — the part of its shape a field table cannot express (TICKET-INL-01)
 *
 * A tier is `{ tier, bonuses }`, and its bonuses are the same `{ statId, modifier }` rows a material
 * tier carries — keyed by stat **id**, so a rename cannot orphan one and this crosses the
 * reference-form boundary untranslated.
 *
 * **A missing rung is not a shape error.** The sheet's Zircon has no tenth tier, and the array is
 * whatever rungs the family has rather than a dense ten: nothing here checks that the numbers are
 * contiguous, start at 1, or reach any particular ceiling, because inventing the rule would mean
 * inventing the missing row. Duplicates and non-integers are refused, since those make *which* tier
 * a socket names unanswerable.
 *
 * @param inlay - One element of `config.inlays`
 * @param path - Where it sits, for the message — `inlays[2]`
 * @returns The errors found, empty when the shape is sound
 */
function inlayTierShapeErrors(inlay: Record<string, unknown>, path: string): string[] {
  if (!Array.isArray(inlay.tiers)) {
    return [`${path}.tiers must be an array`];
  }

  const errors: string[] = [];
  const seenTiers = new Set<number>();

  inlay.tiers.forEach((tier: unknown, tierIndex: number) => {
    const where = `${path}.tiers[${tierIndex}]`;
    if (!tier || typeof tier !== 'object') {
      errors.push(`${where} must be an object`);
      return;
    }
    const row = tier as Record<string, unknown>;

    const isRung = typeof row.tier === 'number' && Number.isInteger(row.tier) && row.tier >= 1;
    if (!isRung) {
      errors.push(`${where}.tier must be a whole number from 1 up`);
    } else if (seenTiers.has(row.tier as number)) {
      errors.push(`${where}.tier ${row.tier} is claimed by more than one row`);
    } else {
      seenTiers.add(row.tier as number);
    }

    if (!Array.isArray(row.bonuses)) {
      errors.push(`${where}.bonuses must be an array`);
      return;
    }

    row.bonuses.forEach((bonus: unknown, bonusIndex: number) => {
      const at = `${where}.bonuses[${bonusIndex}]`;
      if (!bonus || typeof bonus !== 'object') {
        errors.push(`${at} must be an object`);
        return;
      }
      const modifier = bonus as Record<string, unknown>;
      errors.push(...must(isNonEmptyText, 'must be a stat id')(modifier.statId, `${at}.statId`));
      errors.push(
        ...must(isFiniteNumber, 'must be a finite number')(modifier.modifier, `${at}.modifier`)
      );
    });
  });

  return errors;
}

/**
 * A skill's weight rows — the part of its shape a field table cannot express (CR-22)
 *
 * A skill is `{ id, name, description, statWeights }` since TICKET-SKL-02, with rows keyed by stat
 * **id**, so a file still holding a `bonusFormula` and a `code` is reported by name here rather
 * than importing as a skill derived from nothing.
 *
 * @param skill - One element of `config.skills`
 * @param path - Where it sits, for the message — `skills[2]`
 * @returns The errors found, empty when the shape is sound
 */
function skillWeightShapeErrors(skill: Record<string, unknown>, path: string): string[] {
  if (!Array.isArray(skill.statWeights)) {
    return [`${path}.statWeights must be an array`];
  }

  return skill.statWeights.flatMap((row: unknown, rowIndex: number) => {
    const at = `${path}.statWeights[${rowIndex}]`;
    if (!row || typeof row !== 'object') return [`${at} must be an object`];

    const weight = row as Record<string, unknown>;
    return [
      ...must(isNonEmptyText, 'must be a stat id')(weight.statId, `${at}.statId`),
      ...must(isFiniteNumber, 'must be a finite number')(weight.weight, `${at}.weight`),
    ];
  });
}

/**
 * An item template's skill vector — the part of its shape a field table cannot express
 * (v4 systems/11, TICKET-ITEM-01)
 *
 * A bonus is `{ skillId, modifier }`, keyed by skill **id** like a material tier's stat rows, so
 * this crosses the reference-form boundary untranslated and a rename cannot orphan one.
 *
 * **Absent is valid and means the template moves no skill**, which is every template in a ruleset
 * written before the item matrix existed — the field is additive-optional, so the check runs only on
 * a vector that is actually there.
 *
 * **A stored zero is accepted rather than refused.** The editor prunes zero rows on save, because a
 * sparse vector is the stored shape; but a zero contributes nothing and refusing an imported one
 * would reject a file that plays identically. What is refused is a row the engine cannot read — a
 * missing target, or a modifier that is not a finite number. Whether the skill *exists* is
 * `engine/validator.ts`'s report, as it is for a material tier's stat.
 *
 * @param item - One element of `config.items`
 * @param path - Where it sits, for the message — `items[2]`
 * @returns The errors found, empty when the vector is sound or absent
 */
function itemSkillBonusShapeErrors(item: Record<string, unknown>, path: string): string[] {
  const { skillBonuses } = item;
  if (skillBonuses === undefined) return [];

  if (!Array.isArray(skillBonuses)) {
    return [`${path}.skillBonuses must be an array when present`];
  }

  return skillBonuses.flatMap((bonus: unknown, bonusIndex: number) => {
    const at = `${path}.skillBonuses[${bonusIndex}]`;
    if (!bonus || typeof bonus !== 'object') return [`${at} must be an object`];

    const row = bonus as Record<string, unknown>;
    return [
      ...must(isNonEmptyText, 'must be a skill id')(row.skillId, `${at}.skillId`),
      ...must(isFiniteNumber, 'must be a finite number')(row.modifier, `${at}.modifier`),
    ];
  });
}

/** Every glyph a placement may name */
const GLYPH_VALUES = new Set<string>(GLYPH_NAMES);

/**
 * An equipment slot's placement — the part of its shape a field table cannot express
 *
 * Absent is valid and is the state every slot was in before TICKET-INV-03, so a file written
 * against the older shape imports unchanged. A *present* one has to be a whole cell on the board
 * with a glyph the app can draw, because the alternatives are silent: a fractional column places
 * nothing, and an unknown glyph indexes a drawing table that has no entry for it.
 *
 * Whether the cell is inside the configured grid, and whether two slots claim it, are
 * `engine/validator.ts`'s report rather than errors here — both are answerable only by looking at
 * the *rest* of the configuration, and both leave a file that still renders.
 *
 * @param slot - One element of `config.equipmentSlots`
 * @param path - Where it sits, for the message — `equipmentSlots[2]`
 * @returns The errors found, empty when the shape is sound
 */
function placementShapeErrors(slot: Record<string, unknown>, path: string): string[] {
  const { placement } = slot;
  if (placement === undefined) return [];

  const at = `${path}.placement`;
  if (!placement || typeof placement !== 'object' || Array.isArray(placement)) {
    return [`${at} must be a { column, row, glyph } object when present`];
  }

  const cell = placement as Record<string, unknown>;
  const isCellIndex = (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1;

  return [
    ...must(isCellIndex, 'must be a whole number from 1 up')(cell.column, `${at}.column`),
    ...must(isCellIndex, 'must be a whole number from 1 up')(cell.row, `${at}.row`),
    ...oneOf(GLYPH_VALUES, 'must be a glyph the app can draw')(cell.glyph, `${at}.glyph`),
  ];
}

/**
 * The equipment grid — a `Configuration` field that is an object rather than a collection
 *
 * {@link ENTITY_SPECS} covers every *array* on the configuration, which is almost all of it; this
 * is the one shape that needed its own check. Absent is valid and means "never laid out" — the
 * equipment page seeds one on first visit.
 *
 * @param config - The parsed configuration object
 * @returns The errors found, empty when the grid is sound or absent
 */
function equipmentLayoutShapeErrors(config: Record<string, unknown>): string[] {
  const layout = config.equipmentLayout;
  if (layout === undefined) return [];

  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) {
    return ["Field 'equipmentLayout' must be a { columns, rows } object when present"];
  }

  const grid = layout as Record<string, unknown>;
  const within = (max: number) => (value: unknown) =>
    typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max;

  return [
    ...must(
      within(MAX_EQUIPMENT_GRID_COLUMNS),
      `must be a whole number from 1 to ${MAX_EQUIPMENT_GRID_COLUMNS}`
    )(grid.columns, 'equipmentLayout.columns'),
    ...must(
      within(MAX_EQUIPMENT_GRID_ROWS),
      `must be a whole number from 1 to ${MAX_EQUIPMENT_GRID_ROWS}`
    )(grid.rows, 'equipmentLayout.rows'),
  ];
}

/**
 * Everything one of the configuration's collections must satisfy
 *
 * The declarative half of CR-22's fix. Each entity used to be a hand-written checker of the same
 * mechanical assertions, and four of them simply never got one — `items`, `equipmentSlots`,
 * `currencyTiers` and `materialCategories` were `Array.isArray` and nothing more, which is how
 * CR-03's crash-after-persist got in. A missing checker was invisible; a missing row here is not.
 */
interface EntitySpec {
  /** Whether the collection has to be there at all */
  presence: 'required' | 'optional';
  /** One rule per field, applied in declaration order — which is the order errors come out in */
  fields: Record<string, FieldRule>;
  /**
   * A field whose value may not repeat across the collection
   *
   * Checked only when the field's own rule passed, so a malformed name is reported once as
   * malformed rather than twice.
   */
  unique?: { field: string; message: string };
  /**
   * Fields this entity used to carry, and what replaced each (TICKET-INV-05)
   *
   * {@link RETIRED_FIELDS} one level down — see its note for why a retirement is reported rather
   * than ignored. Recorded here rather than in that table because the replacement is described
   * best beside the fields that took the job over, and because the entries are already being
   * walked: a second pass over the same collections is a second place to forget one.
   */
  retired?: Record<string, string>;
  /** What a table cannot say: nested arrays, and lengths measured against another field */
  custom?: (entry: Record<string, unknown>, path: string) => string[];
}

/**
 * Every array-valued key of `Configuration`, whichever table describes it
 *
 * The structural half of CR-22's fix: a collection that reaches `Configuration` without reaching a
 * checker is silence, and silence is how `{"currencyTiers":[null]}` used to arrive in LocalStorage.
 * Derived from the type rather than listed so the set cannot be forgotten.
 */
type AnyCollectionKey = {
  [K in keyof Configuration]-?: NonNullable<Configuration[K]> extends readonly unknown[]
    ? K
    : never;
}[keyof Configuration];

/**
 * The array-of-**entity** keys — what {@link ENTITY_SPECS} describes
 *
 * Adding one to `Configuration` without adding a row there is a **type error**.
 */
type CollectionKey = {
  [K in keyof Configuration]-?: NonNullable<Configuration[K]> extends readonly object[] ? K : never;
}[keyof Configuration];

/**
 * The array-of-**word** keys — what {@link REFERENCE_LIST_SUBJECTS} describes (TICKET-RACE-03)
 *
 * The reference lists — creature sizes and creature types — are `string[]`, which
 * {@link EntitySpec} cannot describe: it walks *entities*, checking a field table against each
 * entry's properties, and a string has none. So they get their own one-line table below, derived
 * from the type the same way {@link CollectionKey} is.
 *
 * `readonly object[]` above is what splits the two — an array of entities satisfies it and an array
 * of strings does not — so neither table can claim a key belonging to the other.
 */
type ReferenceListKey = {
  [K in keyof Configuration]-?: NonNullable<Configuration[K]> extends readonly string[] ? K : never;
}[keyof Configuration];

/**
 * A collection kind neither table describes (CR-22)
 *
 * Splitting `CollectionKey` in two made each half exhaustive over its own kind and neither
 * exhaustive over the whole: a future `number[]`, `boolean[]` or `(string | number)[]` field
 * satisfies neither `readonly object[]` nor `readonly string[]`, would land in no table, and would
 * ship **unchecked and silently** — precisely the hole the single `readonly unknown[]` key existed
 * to close. So the union is proven rather than assumed.
 */
type UncheckedCollectionKey = Exclude<AnyCollectionKey, CollectionKey | ReferenceListKey>;

/**
 * The proof, carried by a table that is actually read
 *
 * Nothing when every array is described — `X & unknown` is `X`, so the table below types exactly as
 * it reads. The moment one is not, this becomes a **required property no literal can satisfy**, and
 * the compile error lands on {@link REFERENCE_LIST_SUBJECTS} naming the offending key. Attached to a
 * real declaration rather than left as a lone `const _assert`, which would be an unused local and a
 * third entry in the typecheck baseline.
 *
 * The fix, when it fires: describe the new kind with a third table and widen this union, or give the
 * field a shape one of the existing two can check.
 */
type EveryCollectionIsChecked = [UncheckedCollectionKey] extends [never]
  ? unknown
  : { readonly UNCHECKED_COLLECTION: UncheckedCollectionKey };

/**
 * What each collection's entries must look like
 *
 * Ordered as the report reads. A rule's message completes `<collection>[<i>].<field> …`, so the
 * wording stays per-field rather than being generated from a type name — "must be a dice ladder
 * id" tells a User where to look and "must be a string" does not.
 */
const ENTITY_SPECS: Record<CollectionKey, EntitySpec> = {
  stats: {
    presence: 'required',
    fields: {
      id: must(isText, 'must be a string'),
      name: must(isText, 'must be a string'),
      // An abbreviation is the stat's spelling in the flat formula space (TICKET-STAT-01), so it
      // has to be identifier-shaped and unique
      abbreviation: must(
        (value) => typeof value === 'string' && ABBREVIATION_PATTERN.test(value),
        'must be an uppercase identifier'
      ),
      order: must(isNumber, 'must be a number'),
      countsTowardTotal: must(isFlag, 'must be a boolean'),
      isResource: must(isFlag, 'must be a boolean'),
      // Which sheet column the stat is listed under (TICKET-STAT-04). Absent is ungrouped, and the
      // string itself is checked for nothing beyond being one — the groups are the User's names
      group: mayBe(isText, 'must be a string when present'),
      // Absent is the invested case; present makes the stat derived
      formula: mayBe(isText, 'must be a string when present'),
      rounding: oneOf(['none', 'nearest', 'up', 'down'], 'must be one of: none, nearest, up, down'),
    },
    unique: { field: 'abbreviation', message: 'must be unique' },
  },

  // `id` is deliberately absent: it is required by the type but files predating TICKET-REF-01 do
  // not carry one, and `ensureReferenceIds` mints it on the way through `importConfiguration`
  skills: {
    presence: 'required',
    fields: {
      id: must(isText, 'must be a string'),
      name: must(isText, 'must be a string'),
    },
    custom: skillWeightShapeErrors,
  },

  materials: {
    presence: 'required',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      categoryId: must(isNonEmptyText, 'must be a material category id'),
    },
    custom: materialLevelShapeErrors,
  },

  materialCategories: {
    presence: 'required',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
    },
  },

  // Optional and absent-means-none (v4 systems/10, TICKET-INL-01), so a ruleset written before gems
  // existed imports untouched. `group` is the sheet's Common/Precious heading — a User word checked
  // for being a string and nothing more, like `Stat.group`. Whether a bonus's stat *exists* is
  // `engine/validator.ts`'s report, as it is for a material tier.
  inlays: {
    presence: 'optional',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      group: mayBe(isText, 'must be a string when present'),
    },
    custom: inlayTierShapeErrors,
  },

  // Every reference is optional — an item may be plain — but a *present* one has to be a string,
  // or the reference checks in `engine/validator.ts` compare a number against a set of ids and
  // report nothing
  items: {
    presence: 'required',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      categoryId: mayBe(isText, 'must be a string when present'),
      equipmentSlotType: mayBe(isText, 'must be a string when present'),
      // Which shop sells the template (v4 systems/11, TICKET-ITEM-01). A User word checked for
      // being a string and nothing more, like `Stat.group` and `Inlay.group` — the nine names the
      // workbook happens to use are seed data, not a vocabulary this gate enforces
      shop: mayBe(isText, 'must be a string when present'),
    },
    // The fused instance, retired by TICKET-INV-05. A v4.0 file never reaches this — the version
    // gate refuses it first (D6's clean break) — so what this catches is a hand-edited or
    // hand-merged file claiming the current version while still fusing a tier onto a template, and
    // the point is that it is told where the pair went instead of importing an item made of nothing.
    retired: {
      materialId:
        "what a thing is made of belongs to the built thing now, so a character's inventory carries the material link on its composed item rather than the template carrying it (TICKET-INV-05)",
      materialLevel:
        "the material tier moved with the material — it is 'materialLevel' on a composed item in a character's inventory (TICKET-INV-05)",
    },
    custom: itemSkillBonusShapeErrors,
  },

  // A slot is identified by its `type` rather than by an id — that is the string an item names —
  // so an empty one is a slot nothing can ever be equipped to
  equipmentSlots: {
    presence: 'required',
    fields: {
      type: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
    },
    custom: placementShapeErrors,
  },

  // A race's `statValues` maps stat **id** to an absolute number (TICKET-RACE-01) — an absent stat
  // reads 0, so the record may be empty, but a present entry has to be a real number
  races: {
    presence: 'required',
    fields: {
      id: must(isText, 'must be a string'),
      name: must(isText, 'must be a string'),
      statValues: recordOf(
        isFiniteNumber,
        'must be an object keyed by stat id',
        'must be a finite number'
      ),
      // The identity fields (v4 systems/04, TICKET-RACE-03). All three are additive-optional, so a
      // ruleset written before them imports untouched. `type` and `size` are checked for being
      // strings and nothing more — *which* string is the ruleset's own reference lists' business,
      // and disagreeing with them is `engine/validator.ts`'s warning rather than a refusal here.
      type: mayBe(isText, 'must be a string when present'),
      size: mayBe(isText, 'must be a string when present'),
      // Stored because the sheet has it and built on nothing; 0 for every playable race
      challengeRate: mayBe(isFiniteNumber, 'must be a finite number when present'),
    },
  },

  // `order` places the tier on the conversion ladder and `conversionToNext` is how many of it make
  // one of the next. Whether the orders are unique and gapless is `engine/validator.ts`'s report.
  currencyTiers: {
    presence: 'required',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      order: must(isFiniteNumber, 'must be a finite number'),
      conversionToNext: must(isFiniteNumber, 'must be a finite number'),
    },
  },

  // Optional and absent-means-none (TICKET-ARC-01). `statAffinity` is sparse by design: an absent
  // stat is `non`.
  archetypes: {
    presence: 'optional',
    fields: {
      id: must(isText, 'must be a string'),
      name: must(isText, 'must be a string'),
      statAffinity: recordOf(
        (value) => typeof value === 'string' && AFFINITY_VALUES.has(value),
        'must be an object keyed by stat id',
        `must be one of ${[...AFFINITY_VALUES].join(', ')}`
      ),
    },
  },

  // Absent is valid, so files predating TICKET-CST-01 still import. `id` is skipped for the reason
  // a skill's is.
  constants: {
    presence: 'optional',
    fields: {
      name: must(
        (value) => typeof value === 'string' && IDENTIFIER_PATTERN.test(value),
        'must be a lowercase identifier'
      ),
      displayName: must(isText, 'must be a string'),
      // Required by Concept 05 — a constant nobody understands is worse than a literal
      description: must(isNonEmptyText, 'is required'),
      value: must(isNumber, 'must be a number'),
    },
    // A duplicate splits identity from value: the stored formula points at one constant's id while
    // the resolver reads the other's number
    unique: { field: 'name', message: 'must be unique' },
  },

  // Absent is valid, so files predating TICKET-CRV-01 still import. `displayName`, `description`
  // and `keyName` are required by the type, so a file missing one imports and then renders a
  // report reading `…has more than one row for undefined 3`.
  curves: {
    presence: 'optional',
    fields: {
      name: must(
        (value) => typeof value === 'string' && IDENTIFIER_PATTERN.test(value),
        'must be a lowercase identifier'
      ),
      displayName: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      keyName: must(isNonEmptyText, 'is required'),
      interpolation: oneOf(CURVE_MODES.interpolation, 'must be one of: step, linear'),
      outOfRange: oneOf(CURVE_MODES.outOfRange, 'must be one of: clamp, extrapolate, error'),
      lookupDirection: oneOf(CURVE_MODES.lookupDirection, 'must be one of: forward, reverse'),
    },
    // The `constants` rule, same reason: a stored formula points at one curve's id while the
    // resolver reads the other's table
    unique: { field: 'name', message: 'must be unique' },
    custom: curveTableShapeErrors,
  },

  // Absent is valid, so files predating ladders still import (Concept 07, TICKET-ROLL-03). Whether
  // the sizes make a *walkable* ladder is `engine/validator.ts`'s report.
  diceLadders: {
    presence: 'optional',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      // Free text rather than an identifier: a ladder is reached by id from a roll definition,
      // never spelled in a formula
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      dieSizes: listOf(isFiniteNumber, 'must be an array of numbers'),
      // Absent is valid and means no cap — the field only exists to express one
      maxPerDie: mayBe(isFiniteNumber, 'must be a finite number when present'),
      showZeroTerms: must(isFlag, 'must be a boolean'),
      // An enum of one (TICKET-ROLL-03's notes), so a file claiming `smallest_die` was written
      // against rules this build does not have and is refused rather than decomposing as `flat`
      remainder: must((value) => value === 'flat', "must be 'flat'"),
    },
  },

  // Absent is valid, so files predating rolls still import (Concept 08, TICKET-ROLL-05). Whether
  // the `input` computes and whether `ladderId` names a ladder that exists are the engine's report.
  rollDefinitions: {
    presence: 'optional',
    fields: {
      id: must(isNonEmptyText, 'must be a non-empty string'),
      name: must(isText, 'must be a string'),
      description: must(isText, 'must be a string'),
      input: must(isText, 'must be a formula string'),
      // Required, unlike most references here: a roll with no ladder has nothing to decompose
      // with, so there is no sensible default to fall back to
      ladderId: must(isNonEmptyText, 'must be a dice ladder id'),
      order: must(isNumber, 'must be a number'),
      // Absent is valid — a ruleset may decline to sort its rolls at all (Concept 08)
      category: mayBe(
        (value) => typeof value === 'string' && ROLL_CATEGORY_VALUES.has(value),
        `must be one of ${[...ROLL_CATEGORY_VALUES].join(', ')} when present`
      ),
    },
  },
};

/**
 * What each reference list is called in a message (v4 systems/14, TICKET-RACE-03)
 *
 * One row per {@link ReferenceListKey}, so a word list added to `Configuration` without a subject
 * here is a type error — and {@link EveryCollectionIsChecked} on the same declaration makes a
 * collection of a *third* kind one too, rather than something that ships unchecked.
 *
 * Both lists are optional and **absent means none**, so a ruleset that names neither imports
 * exactly as it did before they existed. A *present* one has to be an array of strings: the entries
 * are the vocabulary a race's `type` and `size` are compared against, and a number in there would
 * make the comparison quietly never match.
 *
 * Duplicates and casing are deliberately not checked. They are the User's own words — the workbook
 * itself carries `humaniod` — and two spellings of one idea is the same situation `Stat.group` and
 * `Skill.category` are already in: theirs to keep or fix.
 */
const REFERENCE_LIST_SUBJECTS: Record<ReferenceListKey, string> & EveryCollectionIsChecked = {
  creatureSizes: 'creature sizes',
  creatureTypes: 'creature types',
};

/**
 * The reference lists as they arrived
 *
 * @param config - The parsed configuration object
 * @returns One error per list that is present and not a list of strings
 */
function referenceListErrors(config: Record<string, unknown>): string[] {
  const lists = Object.entries(REFERENCE_LIST_SUBJECTS);

  return lists.flatMap(([field, subject]) => {
    const rule = mayBe(
      (value) => Array.isArray(value) && value.every(isText),
      `must be an array of ${subject} when present`
    );
    return rule(config[field], `Field '${field}'`);
  });
}

/**
 * One collection as it arrived, against its spec
 *
 * Whether it is there at all, whether it is an array, and then its entries. An absent *required*
 * collection is reported by the presence pass rather than here, so it is named once; an absent
 * optional one is the older file this build still opens.
 *
 * @param entries - Whatever the file had under this key
 * @param field - The collection's name, for the message
 * @param spec - What it must look like
 * @returns Every error across the collection
 */
function collectionErrors(entries: unknown, field: string, spec: EntitySpec): string[] {
  if (entries === undefined) return [];

  if (!Array.isArray(entries)) {
    return spec.presence === 'optional' ? [`Field '${field}' must be an array when present`] : [];
  }

  return collectionShapeErrors(entries, field, spec);
}

/**
 * Walk one collection's entries against its spec
 *
 * The one checker CR-22 asks for: "is it an array, is each entry an object, then check the entry"
 * used to be a three-line preamble every entity repeated and four entities skipped.
 *
 * @param entries - The collection, already known to be an array
 * @param field - The collection's name, for the message
 * @param spec - What its entries must look like
 * @returns Every error across the collection
 */
function collectionShapeErrors(entries: unknown[], field: string, spec: EntitySpec): string[] {
  const errors: string[] = [];
  const seen = new Set<unknown>();

  entries.forEach((entry: unknown, index: number) => {
    const path = `${field}[${index}]`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${path} must be an object`);
      return;
    }

    const record = entry as Record<string, unknown>;

    for (const [name, rule] of Object.entries(spec.fields)) {
      const found = rule(record[name], `${path}.${name}`);
      errors.push(...found);

      if (found.length > 0 || spec.unique?.field !== name) continue;

      const value = record[name];
      if (seen.has(value)) {
        errors.push(`${path}.${name} ${spec.unique.message}`);
      } else {
        seen.add(value);
      }
    }

    if (spec.retired) errors.push(...retiredEntityFieldErrors(record, path, spec.retired));

    errors.push(...(spec.custom?.(record, path) ?? []));
  });

  return errors;
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

  // The one non-collection shape on the configuration (TICKET-INV-03)
  errors.push(...equipmentLayoutShapeErrors(config));

  // …and the two lists that are collections of plain words rather than of entities (TICKET-RACE-03)
  errors.push(...referenceListErrors(config));

  const specs = Object.entries(ENTITY_SPECS) as [CollectionKey, EntitySpec][];

  // Required array fields
  for (const [field, spec] of specs) {
    if (spec.presence === 'required' && !Array.isArray(config[field])) {
      errors.push(`Field '${field}' must be an array`);
    }
  }

  // Then every collection's entries against its spec (CR-22). Both loops read `ENTITY_SPECS`, so a
  // collection cannot be checked for presence and then forgotten for content — which is exactly
  // what happened to four of them (CR-03).
  for (const [field, spec] of specs) {
    errors.push(...collectionErrors(config[field], field, spec));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Import a configuration that has already been parsed (TICKET-IO-04)
 *
 * **The whole of what "importing" means once the JSON text is out of it**: the version gate, the
 * shape check — retired fields included — then the reference ids a file predating TICKET-REF-01
 * does not carry, then the display spellings. Extracted from {@link importConfiguration} so the
 * server's `POST /api/rulesets/import` runs the *same* three gates in the same order rather than a
 * second chain that agrees on the day it is written (v3 Req 35.2).
 *
 * Text is deliberately not this function's business. The browser has a `File` and the server has a
 * request body it has already parsed; making one of them re-serialise so the other could parse
 * would be a round-trip performed to satisfy a signature.
 *
 * @param data The parsed document, from a file or from a request body
 * @returns The configuration in **display** form, with every reference id minted
 * @throws {SchemaVersionError} If the document was written against another persisted shape
 * @throws {ValidationError} If the shape check finds anything
 */
export function importParsedConfiguration(data: unknown): Configuration {
  assertSupportedSchemaVersion((data as Record<string, unknown> | null)?.schemaVersion);

  const validation = validateConfigurationShape(data);

  if (!validation.isValid) {
    throw new ValidationError('Configuration validation failed', validation.errors);
  }

  return toDisplayConfiguration(
    ensureReferenceIds(data as Configuration, () => crypto.randomUUID())
  );
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
    return importParsedConfiguration(JSON.parse(json));
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
