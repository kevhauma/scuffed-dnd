/**
 * Skill Calculator Tests
 *
 * The centre of this file is Concept 02's **verified table** — six skills read cell-by-cell off
 * the source sheet's sample character (Char 39, Wis 15, Str 10, Int 8), with the level the sheet
 * shows and the bonus it rolls with. It is the closest thing this milestone has to a parity gate
 * until TICKET-DX-04 re-pins it from the corpus.
 *
 * **Validates: Concept 02; Concept 05 (`bonus_divider`); Concept 00 §7**
 */

import { describe, expect, it } from 'vitest';
import type { Character } from '../../types/character';
import type { Configuration, Skill, Stat } from '../../types/config';
import type { FormulaError, FormulaResult } from '../../types/formula';
import { formulaError, rootCause } from '../formula/errors';
import { calculateSkills } from './skillCalculator';

/** The sample character's four stats, ids matching the sheet's names */
const SAMPLE_STATS: Array<[id: string, abbreviation: string, value: number]> = [
  ['char', 'CHA', 39],
  ['wis', 'WIS', 15],
  ['str', 'STR', 10],
  ['int', 'INT', 8],
];

function stat(id: string, abbreviation: string): Stat {
  return {
    id,
    name: id,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
  };
}

function skill(id: string, name: string, statWeights: Skill['statWeights']): Skill {
  return { id, name, description: '', statWeights };
}

function createConfig(skills: Skill[], overrides: Partial<Configuration> = {}): Configuration {
  return {
    id: 'config1',
    name: 'Test Config',
    version: '1.0',
    schemaVersion: 7,
    stats: SAMPLE_STATS.map(([id, abbreviation]) => stat(id, abbreviation)),
    skills,
    combatSkills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    focusStatBonusLevel: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

function createCharacter(investedSkillPoints: Record<string, number> = {}): Character {
  return {
    id: 'char1',
    name: 'Sample',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints,
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  };
}

/** The sample character's composed stat values, which the calculator takes as given */
const SAMPLE_VALUES: Record<string, FormulaResult> = Object.fromEntries(
  SAMPLE_STATS.map(([id, , value]) => [id, value])
);

describe("Concept 02's verified table", () => {
  // Weights, level and bonus exactly as the concept page records them from the sheet
  const CASES: Array<{
    name: string;
    weights: Skill['statWeights'];
    level: number;
    bonus: number;
  }> = [
    { name: 'Charm', weights: [{ statId: 'char', weight: 0.3 }], level: 11.7, bonus: 2 },
    { name: 'Trading', weights: [{ statId: 'char', weight: 0.3 }], level: 11.7, bonus: 2 },
    { name: 'Brewing', weights: [{ statId: 'wis', weight: 0.3 }], level: 4.5, bonus: 1 },
    { name: 'Black smithing', weights: [{ statId: 'str', weight: 0.2 }], level: 2.0, bonus: 0 },
    { name: 'alchemy', weights: [{ statId: 'int', weight: 0.2 }], level: 1.6, bonus: 0 },
  ];

  const skills = CASES.map((testCase, index) =>
    skill(`skill-${index}`, testCase.name, testCase.weights)
  );
  const { levels, bonuses } = calculateSkills(
    createConfig(skills),
    SAMPLE_VALUES,
    createCharacter()
  );

  it.each(CASES)('reproduces $name — level $level, bonus $bonus', ({ name, level, bonus }) => {
    const id = skills.find((candidate) => candidate.name === name)?.id as string;

    // `toBeCloseTo` because 39 × 0.3 is 11.700000000000001 in binary floating point — the sheet's
    // number is 11.7 and the bonus rounds off the same either way
    expect(levels[id]).toBeCloseTo(level, 10);
    expect(bonuses[id]).toBe(bonus);
  });

  it('reproduces Persuasion, the one row with invested points — level 13.2, bonus 3', () => {
    // The concept page's `+1.5` for one starting pick. The invested→level conversion is 1:1 and
    // **provisional** here (TICKET-ARC-02 routes it through the point-buy curve), so the 1.5 is
    // supplied as the invested amount rather than derived from a pick.
    const persuasion = skill('persuasion', 'Persuasion', [{ statId: 'char', weight: 0.3 }]);
    const { levels, bonuses } = calculateSkills(
      createConfig([persuasion]),
      SAMPLE_VALUES,
      createCharacter({ persuasion: 1.5 })
    );

    expect(levels.persuasion).toBeCloseTo(13.2, 10);
    expect(bonuses.persuasion).toBe(3);
  });

  it('rounds half away from zero — level 7.5 is bonus 2, not 1', () => {
    // The case that tells Excel's ROUND apart from a naive floor: 7.5 / 5 = 1.5
    const perception = skill('perception', 'perception', [{ statId: 'char', weight: 0.5 }]);
    const { levels, bonuses } = calculateSkills(
      createConfig([perception]),
      { char: 15 },
      createCharacter()
    );

    expect(levels.perception).toBe(7.5);
    expect(bonuses.perception).toBe(2);
  });
});

describe('the bonus divider (Concept 05)', () => {
  const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);

  function constant(value: number) {
    return {
      id: 'const-bd',
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description: 'Level per point of bonus',
      value,
    };
  }

  it('moves every bonus when the constant is retuned, with nothing else touched', () => {
    // Concept 02's editing scenario: "make bonuses grow faster" is one constant, not 48 edits
    const config = createConfig([charm], { constants: [constant(4)] });
    const { levels, bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter());

    // 11.7 / 4 = 2.925 → 3, where the seeded 5 gave 2
    expect(levels.charm).toBeCloseTo(11.7, 10);
    expect(bonuses.charm).toBe(3);
  });

  it('falls back to the seeded 5 when the ruleset defines no such constant', () => {
    const { bonuses } = calculateSkills(createConfig([charm]), SAMPLE_VALUES, createCharacter());

    expect(bonuses.charm).toBe(2);
  });

  it.each([0, -5, Number.NaN])('falls back to the seeded 5 rather than dividing by %s', (value) => {
    const config = createConfig([charm], { constants: [constant(value)] });
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter());

    // Infinity or NaN would be a worse answer than the seed (Concept 00 §7)
    expect(bonuses.charm).toBe(2);
  });
});

describe('weight rows', () => {
  it('sums a two-stat skill, the sheet’s 0.2 + 0.1 split', () => {
    // Cooking: Wis 0.2 + Dex 0.1 in Concept 02's seed table, read here off Wis 15 and Str 10
    const cooking = skill('cooking', 'Cooking', [
      { statId: 'wis', weight: 0.2 },
      { statId: 'str', weight: 0.1 },
    ]);
    const { levels, bonuses } = calculateSkills(
      createConfig([cooking]),
      SAMPLE_VALUES,
      createCharacter()
    );

    // 15 × 0.2 + 10 × 0.1 = 4
    expect(levels.cooking).toBeCloseTo(4, 10);
    expect(bonuses.cooking).toBe(1);
  });

  it('is exactly the invested points when a skill has no weights at all', () => {
    const unweighted = skill('lore', 'Lore', []);
    const { levels, bonuses } = calculateSkills(
      createConfig([unweighted]),
      SAMPLE_VALUES,
      createCharacter({ lore: 12 })
    );

    expect(levels.lore).toBe(12);
    expect(bonuses.lore).toBe(2);
  });

  it('is 0 for a skill with neither weights nor investment', () => {
    // Concept 02's warn case — always level 0, but a number rather than a gap
    const { levels, bonuses } = calculateSkills(
      createConfig([skill('lore', 'Lore', [])]),
      SAMPLE_VALUES,
      createCharacter()
    );

    expect(levels.lore).toBe(0);
    expect(bonuses.lore).toBe(0);
  });

  it('adds invested points on top of the weighted sum', () => {
    const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
    const { levels } = calculateSkills(
      createConfig([charm]),
      SAMPLE_VALUES,
      createCharacter({ charm: 3 })
    );

    expect(levels.charm).toBeCloseTo(14.7, 10);
  });

  it('skips a weight naming a stat the ruleset no longer defines', () => {
    // The validator reports it (`Skill "…" is weighted on a stat that does not exist`); the
    // calculator contributes nothing for it rather than poisoning the level, the same rule a
    // dangling race entry gets (TICKET-REF-02)
    const charm = skill('charm', 'Charm', [
      { statId: 'char', weight: 0.3 },
      { statId: 'gone', weight: 5 },
    ]);
    const { levels } = calculateSkills(createConfig([charm]), SAMPLE_VALUES, createCharacter());

    expect(levels.charm).toBeCloseTo(11.7, 10);
  });
});

describe('errors as values (Concept 00 §7)', () => {
  it('carries a broken stat into the level as an upstream error naming the skill', () => {
    // The whole chain, asserted here rather than only through the sheet's chip: `withSource` keeps
    // the *first* source it is given, so returning the stat's own error would leave the level
    // claiming to belong to the stat and stop the chain at one link. An `upstream` wrapper is what
    // makes the skill nameable and keeps the root cause reachable (Concept 00 §7).
    const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
    const broken = formulaError('undefined-variable', 'Undefined variable: NOPE');

    const { levels } = calculateSkills(createConfig([charm]), { char: broken }, createCharacter());

    expect(levels.charm).toMatchObject({
      formulaError: true,
      kind: 'upstream',
      // Names the stat that failed, so the chip says which input to go and fix
      message: 'char could not be calculated',
      source: { kind: 'skill', id: 'charm', name: 'Charm' },
      cause: broken,
    });
    expect(rootCause(levels.charm as FormulaError)).toEqual(broken);
  });

  it('says the same thing in the bonus rather than a confident 0', () => {
    const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
    const broken = formulaError('undefined-variable', 'Undefined variable: NOPE');

    const { levels, bonuses } = calculateSkills(
      createConfig([charm]),
      { char: broken },
      createCharacter()
    );

    expect(bonuses.charm).toEqual(levels.charm);
  });

  it('still computes every other skill when one depends on a broken stat', () => {
    const skills = [
      skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]),
      skill('brewing', 'Brewing', [{ statId: 'wis', weight: 0.3 }]),
    ];
    const values = {
      ...SAMPLE_VALUES,
      char: formulaError('undefined-variable', 'Undefined variable: NOPE'),
    };

    const { levels } = calculateSkills(createConfig(skills), values, createCharacter());

    expect(levels.charm).toMatchObject({ formulaError: true });
    expect(levels.brewing).toBe(4.5);
  });
});

describe('the breakdown behind a level (TICKET-SKL-03)', () => {
  it('reports one already-multiplied term per weight row, in the skill’s own order', () => {
    const cooking = skill('cooking', 'Cooking', [
      { statId: 'wis', weight: 0.2 },
      { statId: 'str', weight: 0.1 },
    ]);

    const { levels, contributions } = calculateSkills(
      createConfig([cooking]),
      SAMPLE_VALUES,
      createCharacter()
    );

    expect(contributions.cooking).toEqual([
      { statId: 'wis', weight: 0.2, statValue: 15, contribution: 3 },
      { statId: 'str', weight: 0.1, statValue: 10, contribution: 1 },
    ]);
    // The terms account for the level exactly, which is the property that lets the sheet show them
    // beside it without either number having to be recomputed
    expect(contributions.cooking.reduce((sum, row) => sum + row.contribution, 0)).toBe(
      levels.cooking
    );
  });

  it('leaves the invested points out of the terms — they are the Player’s, not a stat’s', () => {
    const persuasion = skill('persuasion', 'Persuasion', [{ statId: 'char', weight: 0.3 }]);

    const { levels, contributions } = calculateSkills(
      createConfig([persuasion]),
      SAMPLE_VALUES,
      createCharacter({ persuasion: 1.5 })
    );

    expect(contributions.persuasion).toEqual([
      { statId: 'char', weight: 0.3, statValue: 39, contribution: 11.7 },
    ]);
    expect(levels.persuasion).toBeCloseTo(13.2, 10);
  });

  it('skips a weight row naming a stat the ruleset no longer defines', () => {
    const stale = skill('stale', 'Stale', [
      { statId: 'char', weight: 0.3 },
      { statId: 'deleted', weight: 0.5 },
    ]);

    const { contributions } = calculateSkills(
      createConfig([stale]),
      SAMPLE_VALUES,
      createCharacter()
    );

    expect(contributions.stale).toEqual([
      { statId: 'char', weight: 0.3, statValue: 39, contribution: 11.7 },
    ]);
  });

  it('reports no terms at all for a level that failed, rather than half a sum', () => {
    const charm = skill('charm', 'Charm', [
      { statId: 'wis', weight: 0.3 },
      { statId: 'char', weight: 0.3 },
    ]);
    const values = {
      ...SAMPLE_VALUES,
      char: formulaError('undefined-variable', 'Undefined variable: NOPE'),
    };

    const { levels, contributions } = calculateSkills(
      createConfig([charm]),
      values,
      createCharacter()
    );

    expect(levels.charm).toMatchObject({ formulaError: true });
    // `wis` had already contributed 4.5 before `char` failed — reporting it would show a breakdown
    // that sums to a number the sheet is not displaying
    expect(contributions.charm).toEqual([]);
  });

  it('gives a weightless skill an empty breakdown rather than leaving it absent', () => {
    const pure = skill('pure', 'Pure Investment', []);

    const { contributions } = calculateSkills(
      createConfig([pure]),
      SAMPLE_VALUES,
      createCharacter({ pure: 3 })
    );

    expect(contributions.pure).toEqual([]);
  });
});
