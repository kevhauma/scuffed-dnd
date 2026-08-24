/**
 * The shipped example ruleset is a real, importable ruleset — proven, not assumed.
 *
 * `examples/demo-ruleset.json` is the file a new User is pointed at to see what a finished ruleset
 * looks like, which makes it the one piece of data in the repo nobody exercises by accident: it is
 * not a fixture, no component reads it, and no build step regenerates it. It went stale exactly
 * that way — TICKET-STAT-01 left it at `schemaVersion` 2 and nothing noticed across three further
 * reshapes, so by the time anyone tried to open it the app refused it outright.
 *
 * This suite is what makes it trustworthy. It runs the same two gates the app runs — the importer
 * behind the Import button and `engine/validator.ts`'s report — so the example cannot drift past a
 * persisted-shape change again without a red test naming it.
 *
 * A failure here is the example's problem, never the test's: bring the file forward to whatever
 * `SUPPORTED_SCHEMA_VERSION` now is, reshaping the entities the bump moved.
 *
 * **Validates: Requirements 1.4, 1.5, 1.6; Concept 00 §6**
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateConfiguration as validateRuleset } from '../engine/validator';
import { SUPPORTED_SCHEMA_VERSION } from '../types/config';
import { importConfiguration, validateConfigurationShape } from './importExport';

const EXAMPLE_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'examples',
  'demo-ruleset.json'
);

const contents = readFileSync(EXAMPLE_FILE, 'utf-8');

describe('the shipped example ruleset', () => {
  it('passes the importer the app itself uses', () => {
    expect(validateConfigurationShape(JSON.parse(contents))).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it('imports at the current schema version', () => {
    // The version gate runs before validation (TICKET-IO-03), so a stale example is refused whole
    // rather than reported field by field — which is why the number is asserted on its own
    const config = importConfiguration(contents);

    expect(config.schemaVersion).toBe(SUPPORTED_SCHEMA_VERSION);
    expect(config.name).toBe('Emberfall Demo Ruleset');
  });

  it('has no validation errors in the report the config dashboard shows', () => {
    // The importer checks shapes; this checks that the references between them resolve — a
    // material tier modifying a derived stat, a weight on a stat that does not exist, a formula
    // naming a retired skill code. All three are how a reshape leaves the example half-converted.
    const report = validateRuleset(importConfiguration(contents));

    expect(report.errors).toEqual([]);
    expect(report.isValid).toBe(true);
  });
});

describe('the example carries each reshaped entity in its current form', () => {
  const config = importConfiguration(contents);
  const statId = (abbreviation: string) =>
    config.stats.find((stat) => stat.abbreviation === abbreviation)?.id;

  it('weights skills on stats rather than carrying a bonus formula (TICKET-SKL-02)', () => {
    const athletics = config.skills.find((skill) => skill.name === 'Athletics');

    // `(STR + CON) / 2` as data: the arithmetic moved to the calculator, the numbers did not move
    expect(athletics?.statWeights).toEqual([
      { statId: statId('STR'), weight: 0.5 },
      { statId: statId('CON'), weight: 0.5 },
    ]);
    expect(config.skills.every((skill) => skill.statWeights.length > 0)).toBe(true);
  });

  it('reaches a skill from a roll input by name slug, not by a 3-letter code', () => {
    const melee = config.rollDefinitions?.find((roll) => roll.name === 'Melee');

    expect(melee?.input).toBe('STR + skills.athletics / 2');
  });

  it('gives every race a stat block keyed by stat id (TICKET-RACE-01)', () => {
    const dwarf = config.races.find((race) => race.name === 'Dwarf');

    expect(dwarf?.statValues).toEqual({
      [statId('CON') as string]: 2,
      [statId('STR') as string]: 1,
      [statId('DEX') as string]: -1,
    });
  });

  it('targets material tier bonuses at invested stats (TICKET-MAT-01)', () => {
    const derived = new Set(
      config.stats.filter((stat) => stat.formula !== undefined).map((stat) => stat.id)
    );
    const bonuses = config.materials.flatMap((material) =>
      material.levels.flatMap((level) => level.bonuses)
    );

    expect(bonuses.length).toBeGreaterThan(0);
    // Every bonus names a stat that exists, and none names one whose formula is its only source
    expect(bonuses.filter((bonus) => derived.has(bonus.statId))).toEqual([]);
    expect(
      bonuses.filter((bonus) => !config.stats.some((stat) => stat.id === bonus.statId))
    ).toEqual([]);
  });
});
