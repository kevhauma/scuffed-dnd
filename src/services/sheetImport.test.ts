/**
 * The sheet-import corpus is a real, importable ruleset — proven, not assumed.
 *
 * `docs/imports/` holds one fragment per built feature, carrying that feature's slice of the
 * source spreadsheet, and `docs/imports/ducklets.json` is the merge of all of them. This suite is
 * what makes those files trustworthy: the envelope is present on every fragment, the committed
 * merge matches what the fragments currently say, and the result passes the same
 * `validateConfiguration` the app's Import button runs.
 *
 * A failure here means one of three things, in rough order of likelihood: a fragment changed and
 * `yarn run sheet:import` was not re-run; a fragment was hand-edited into a shape the importer
 * refuses; or a persisted shape changed and the corpus has not caught up. All three are the
 * corpus's problem to fix — never the test's.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildConfiguration,
  collisions,
  IMPORTS_DIR,
  OUTPUT_FILE,
  readFragments,
  renderConfiguration,
} from '../../scripts/build-sheet-import.mjs';
import { importConfiguration, validateConfiguration } from './importExport';

const fragments = readFragments();

describe('sheet import fragments', () => {
  it('finds a fragment for every built feature', () => {
    expect(fragments.map((entry) => entry.name)).toEqual([
      'combat-skills.json',
      'constants.json',
      'currency-tiers.json',
      'curves.json',
      'equipment-slots.json',
      'items.json',
      'materials.json',
      'races.json',
      'speciality-skills.json',
      'stats.json',
    ]);
  });

  it.each(fragments)('$name carries its provenance envelope', ({ fragment }) => {
    expect(typeof fragment.feature).toBe('string');
    expect(typeof fragment.title).toBe('string');
    expect(Array.isArray(fragment.tickets)).toBe(true);
    expect(typeof fragment.concept).toBe('string');
    expect(fragment.source.spreadsheet).toMatch(/^https:\/\/docs\.google\.com\/spreadsheets\//);
    expect(fragment.source.ranges.length).toBeGreaterThan(0);
    expect(typeof fragment.confidence).toBe('string');
    // Notes are where a value that does *not* fit the current shape gets recorded, so a fragment
    // with none is a fragment nobody wrote down the caveats for
    expect(fragment.notes.length).toBeGreaterThan(0);
    expect(Object.keys(fragment.data).length).toBeGreaterThan(0);
  });
});

describe('the merged ruleset', () => {
  const committed = readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8');

  it('is up to date with the fragments', () => {
    // Re-runs the merge rather than comparing counts: a fragment edited without regenerating is
    // the failure this catches, and it looks identical from the outside until you diff the bytes
    expect(committed).toBe(renderConfiguration());
  });

  it('has no id or formula-spelling collisions across fragments', () => {
    expect(collisions(buildConfiguration(fragments))).toEqual([]);
  });

  it('passes the importer the app itself uses', () => {
    expect(validateConfiguration(JSON.parse(committed))).toEqual({ isValid: true, errors: [] });
  });

  it('imports as a v2 configuration with the sheet in it', () => {
    const config = importConfiguration(committed);

    expect(config.schemaVersion).toBe(2);
    expect(config.stats.map((stat) => stat.abbreviation)).toContain('APT');
    expect(config.specialitySkills).toHaveLength(48);
    expect(config.curves?.find((curve) => curve.name === 'point_buy')?.rows).toHaveLength(51);
  });
});

describe('the confirmed derivations survive the round trip', () => {
  const config = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));

  it('keeps the six-core-only stat totals (Concept 01)', () => {
    const core = new Set(
      config.stats.filter((stat) => stat.countsTowardTotal).map((stat) => stat.abbreviation)
    );
    const total = (race: string) =>
      config.races
        .find((candidate) => candidate.name === race)
        ?.skillModifiers.filter((modifier) => core.has(modifier.skillCode))
        .reduce((sum, modifier) => sum + modifier.modifier, 0);

    expect(core.size).toBe(6);
    expect(total('human')).toBe(60);
    expect(total('elf')).toBe(64);
    expect(total('dwarf')).toBe(60);
    expect(total('Raccoon')).toBe(59);
    expect(total('Demon')).toBe(90);
  });

  it('keeps the point-buy main column at 0.75 x (points + 1) (Concept 06)', () => {
    const pointBuy = config.curves?.find((curve) => curve.name === 'point_buy');
    const main = pointBuy?.columns.findIndex((column) => column.name === 'main') ?? -1;

    expect(main).toBeGreaterThanOrEqual(0);
    for (const row of pointBuy?.rows ?? []) {
      expect(row.values[main]).toBeCloseTo(0.75 * (row.key + 1), 10);
    }
  });

  it('keeps the skill weights Concept 02 confirmed', () => {
    const formula = (name: string) =>
      config.specialitySkills.find((skill) => skill.name === name)?.bonusFormula;

    expect(formula('Charm')).toBe('CHA * 0.3');
    expect(formula('Trading')).toBe('CHA * 0.3');
    expect(formula('Brewing')).toBe('WIS * 0.3');
    expect(formula('Black smithing')).toBe('STR * 0.2');
    expect(formula('alchemy')).toBe('INT * 0.2');
    expect(formula('Cooking')).toBe('WIS * 0.2 + DEX * 0.1');
  });

  it('keeps the constants the sheet labels (Concept 05)', () => {
    const value = (name: string) =>
      config.constants?.find((constant) => constant.name === name)?.value;

    expect(value('bonus_divider')).toBe(5);
    expect(value('apt_value')).toBe(30);
    expect(value('points_per_level')).toBe(3);
  });
});
