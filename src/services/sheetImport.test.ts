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
import { decomposeValue } from '../engine/dice/diceLadder';
import { statMemberName } from '../engine/formula/references';
import { validateFormula } from '../engine/formula/validator';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import { importConfiguration, validateConfiguration } from './importExport';

const fragments = readFragments();

describe('sheet import fragments', () => {
  it('finds a fragment for every built feature', () => {
    expect(fragments.map((entry) => entry.name)).toEqual([
      'archetypes.json',
      'combat-skills.json',
      'constants.json',
      'currency-tiers.json',
      'curves.json',
      'dice-ladders.json',
      'equipment-slots.json',
      'items.json',
      'materials.json',
      'races.json',
      'roll-definitions.json',
      'skills.json',
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

  it('imports at the current schema version, with the sheet in it', () => {
    const config = importConfiguration(committed);

    expect(config.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(config.stats.map((stat) => stat.abbreviation)).toContain('APT');
    expect(config.skills).toHaveLength(48);
    expect(config.curves?.find((curve) => curve.name === 'point_buy')?.rows).toHaveLength(51);
  });
});

describe('the confirmed derivations survive the round trip', () => {
  const config = importConfiguration(readFileSync(join(IMPORTS_DIR, OUTPUT_FILE), 'utf-8'));

  it('keeps the six-core-only stat totals (Concept 01)', () => {
    // A race is a stat block keyed by stat id since TICKET-RACE-01, so the six-core total is a
    // sum over the counted stats rather than a filter over a modifier list
    const core = config.stats.filter((stat) => stat.countsTowardTotal);
    const total = (race: string) => {
      const block = config.races.find((candidate) => candidate.name === race)?.statValues;
      if (!block) return undefined;
      return core.reduce((sum, stat) => sum + (block[stat.id] ?? 0), 0);
    };

    expect(core).toHaveLength(6);
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

  it('keeps the dice ladder decomposing the sheet values (Concept 07)', () => {
    const ladder = config.diceLadders?.[0];
    if (!ladder) throw new Error('the corpus carries no dice ladder');

    const row = (value: number) => {
      const { counts, flat } = decomposeValue(value, ladder);
      return [...counts.map((entry) => entry.count), flat];
    };

    expect(ladder.dieSizes).toEqual([20, 12, 6]);
    expect(row(10)).toEqual([0, 0, 1, 4]);
    expect(row(39)).toEqual([1, 1, 1, 1]);
  });

  it('keeps every roll reading a stat down a ladder that exists (Concept 08)', () => {
    // The two references a roll holds, checked against what the corpus actually defines: the
    // ladder by id, and the input's `stats.<slug>` against the stats fragment
    const ladderIds = new Set((config.diceLadders ?? []).map((ladder) => ladder.id));
    const slugs = new Set(config.stats.map((stat) => statMemberName(stat)));

    expect(config.rollDefinitions).toHaveLength(4);
    for (const roll of config.rollDefinitions ?? []) {
      expect(ladderIds.has(roll.ladderId), `${roll.name} names a missing ladder`).toBe(true);
      for (const reference of validateFormula(roll.input).namespacedReferences) {
        expect(slugs.has(reference.member), `${roll.name} reads a missing stat`).toBe(true);
      }
    }
  });

  it('keeps the two roll inputs Concept 08 confirmed, and only those two', () => {
    const inputOf = (name: string) =>
      config.rollDefinitions?.find((roll) => roll.name === name)?.input;

    // Confirmed: input 10 at Str 10, input 11 at Dex 11
    expect(inputOf('mele')).toBe('stats.strenght');
    expect(inputOf('Ranged')).toBe('stats.dex');
    // NOT confirmed — the sheet's 18 and 16 carry an unexplained term, so the corpus ships the raw
    // stat and says so rather than fitting a constant nobody can source
    expect(inputOf('evasion')).toBe('stats.dex');
    expect(inputOf('endure')).toBe('stats.con');
  });

  it('keeps the skill weights Concept 02 confirmed', () => {
    // Weight rows rather than a formula string since TICKET-SKL-02, and keyed by stat **id** —
    // so this reads through the stats to check the spelling the concept page uses
    const abbreviationOf = (statId: string) =>
      config.stats.find((stat) => stat.id === statId)?.abbreviation;

    const weights = (name: string) =>
      config.skills
        .find((skill) => skill.name === name)
        ?.statWeights.map(({ statId, weight }) => `${abbreviationOf(statId)} ${weight}`)
        .join(' + ');

    expect(weights('Charm')).toBe('CHA 0.3');
    expect(weights('Trading')).toBe('CHA 0.3');
    expect(weights('Brewing')).toBe('WIS 0.3');
    expect(weights('Black smithing')).toBe('STR 0.2');
    expect(weights('alchemy')).toBe('INT 0.2');
    expect(weights('Cooking')).toBe('WIS 0.2 + DEX 0.1');
  });

  it('keeps every weight pointing at a stat the corpus actually defines', () => {
    // The failure mode a fragment keyed by id has that a formula string did not: a weight can
    // name an id no stats.json row supplies, and nothing spells it out at import time
    const statIds = new Set(config.stats.map((stat) => stat.id));
    const dangling = config.skills.flatMap((skill) =>
      skill.statWeights
        .filter((row) => !statIds.has(row.statId))
        .map((row) => `${skill.name} → ${row.statId}`)
    );

    expect(dangling).toEqual([]);
  });

  it('keeps the constants the sheet labels (Concept 05)', () => {
    const value = (name: string) =>
      config.constants?.find((constant) => constant.name === name)?.value;

    expect(value('bonus_divider')).toBe(5);
    expect(value('apt_value')).toBe(30);
    expect(value('points_per_level')).toBe(3);
  });
});
