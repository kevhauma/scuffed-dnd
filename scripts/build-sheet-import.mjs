/**
 * Build the merged sheet-import ruleset from the per-feature fragments.
 *
 * Every built feature owns one fragment in `docs/imports/`, carrying that feature's slice of the
 * source spreadsheet plus the provenance to check it against. This script folds them into one
 * `docs/imports/ducklets.json` — a whole `Configuration`, which is the only thing the app's
 * importer accepts.
 *
 * Run it with `yarn run sheet:import` after adding or editing a fragment. The output is
 * deterministic: fragments merge in alphabetical filename order and the timestamps are fixed to
 * the export date, so regenerating an unchanged tree produces a byte-identical file.
 *
 * `src/services/sheetImport.test.ts` is the guard — it re-runs this merge in memory, fails if the
 * committed output has drifted, and puts the result through the real `validateConfiguration`.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where the fragments live, relative to this file */
export const IMPORTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'imports');

/** The merged file's name — excluded from the fragment scan so it never merges into itself */
export const OUTPUT_FILE = 'ducklets.json';

/**
 * The date the spreadsheet was exported.
 *
 * Used for both timestamps instead of "now" so that regenerating produces no diff. A generated
 * file that changes every run is a file nobody reviews.
 */
const EXPORTED_AT = '2026-08-09T00:00:00.000Z';

/** Every array a `Configuration` requires, so a missing fragment leaves an empty list, not a hole */
const REQUIRED_ARRAYS = [
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

/** Optional arrays — present only when a fragment supplies them, matching `Configuration` */
const OPTIONAL_ARRAYS = ['constants', 'curves', 'archetypes', 'diceLadders'];

/**
 * Read every fragment, in a fixed order
 *
 * @param dir - Directory to scan, defaults to `docs/imports`
 * @returns One entry per fragment: its filename and parsed contents
 */
export function readFragments(dir = IMPORTS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== OUTPUT_FILE)
    .sort()
    .map((name) => ({ name, fragment: JSON.parse(readFileSync(join(dir, name), 'utf-8')) }));
}

/**
 * Reject a fragment that cannot be merged
 *
 * A fragment naming an unknown key is an error rather than a silent no-op — that is almost always
 * a typo in a hand-written fragment, and a silent one would drop a whole feature's data.
 *
 * @param name - The fragment's filename, for the message
 * @param fragment - Its parsed contents
 * @param known - Every `Configuration` array field a fragment may write
 * @throws If the envelope is incomplete or a data key is unusable
 */
function assertMergeable(name, fragment, known) {
  for (const field of ['feature', 'source', 'data']) {
    if (!fragment[field]) {
      throw new Error(`${name}: fragment is missing '${field}'`);
    }
  }
  for (const [key, value] of Object.entries(fragment.data)) {
    if (!known.has(key)) {
      throw new Error(`${name}: unknown entity key '${key}'`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`${name}: '${key}' must be an array`);
    }
  }
}

/**
 * Fold the fragments into one importable configuration
 *
 * Each fragment contributes whole entity arrays under its own keys, so two fragments never write
 * the same key and merge order cannot change the result.
 *
 * @param entries - What `readFragments` returned
 * @returns The merged `Configuration`
 * @throws If a fragment is missing its envelope or names an unknown entity key
 */
export function buildConfiguration(entries) {
  const config = {
    id: 'ducklets-sheet-import',
    name: 'Ducklets (sheet import)',
    version: '2.0.0',
    // Must track `SUPPORTED_SCHEMA_VERSION` in src/types/config.ts, which this script cannot
    // import (it is TypeScript). `exampleRuleset.test.ts` asserts the two agree, so drift fails
    // the suite rather than producing a corpus the app then refuses to import.
    schemaVersion: 8,
    createdAt: EXPORTED_AT,
    updatedAt: EXPORTED_AT,
  };
  for (const key of REQUIRED_ARRAYS) {
    config[key] = [];
  }

  const known = new Set([...REQUIRED_ARRAYS, ...OPTIONAL_ARRAYS]);

  for (const { name, fragment } of entries) {
    assertMergeable(name, fragment, known);
    for (const [key, value] of Object.entries(fragment.data)) {
      config[key] = [...(config[key] ?? []), ...value];
    }
  }

  return config;
}

/**
 * Ids and formula spellings that must not repeat across fragments
 *
 * The merge itself cannot catch these — two fragments each holding a valid list can still collide
 * once concatenated, and a duplicate spelling in the flat namespace makes every formula naming it
 * ambiguous.
 *
 * @param config - The merged configuration
 * @returns The problems found, empty when the merge is sound
 */
export function collisions(config) {
  const problems = [];

  const seenIds = new Map();
  for (const key of [...REQUIRED_ARRAYS, ...OPTIONAL_ARRAYS]) {
    for (const entity of config[key] ?? []) {
      if (!entity.id) continue;
      const owner = seenIds.get(entity.id);
      if (owner) {
        problems.push(`duplicate id '${entity.id}' in ${owner} and ${key}`);
      } else {
        seenIds.set(entity.id, key);
      }
    }
  }

  // A stat abbreviation and a roll code share one flat formula namespace (TICKET-STAT-01). A
  // `Skill` left it with TICKET-SKL-02 — it is reached as `skills.<name-slug>` instead.
  const spellings = new Map();
  const namespace = [
    ...config.stats.map((stat) => [stat.abbreviation, `stat '${stat.name}'`]),
    ...config.combatSkills.map((skill) => [skill.code, `roll '${skill.name}'`]),
  ];
  for (const [spelling, owner] of namespace) {
    const first = spellings.get(spelling);
    if (first) {
      problems.push(`'${spelling}' is used by both ${first} and ${owner}`);
    } else {
      spellings.set(spelling, owner);
    }
  }

  return problems;
}

/**
 * The merged file exactly as it is written to disk
 *
 * One function so the script and the test cannot disagree about formatting — a trailing-newline
 * difference would otherwise read as drift.
 *
 * @param dir - Directory to read fragments from
 * @returns The file's contents
 */
export function renderConfiguration(dir = IMPORTS_DIR) {
  const config = buildConfiguration(readFragments(dir));
  const problems = collisions(config);
  if (problems.length > 0) {
    throw new Error(`sheet import has collisions:\n  ${problems.join('\n  ')}`);
  }
  return `${JSON.stringify(config, null, 2)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const contents = renderConfiguration();
  writeFileSync(join(IMPORTS_DIR, OUTPUT_FILE), contents, 'utf-8');
  const config = JSON.parse(contents);
  const counts = [...REQUIRED_ARRAYS, ...OPTIONAL_ARRAYS]
    .filter((key) => (config[key] ?? []).length > 0)
    .map((key) => `${key} ${config[key].length}`)
    .join(', ');
  console.log(`docs/imports/${OUTPUT_FILE}: ${counts}`);
}
