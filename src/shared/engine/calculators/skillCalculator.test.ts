/**
 * Skill Calculator Tests
 *
 * The centre of this file is Concept 02's **verified table** — six skills read cell-by-cell off
 * the source sheet's sample character (Char 39, Wis 15, Str 10, Int 8), with the level the sheet
 * shows and the bonus it rolls with. It is the closest thing this milestone has to a parity gate
 * until TICKET-DX-04 re-pins it from the corpus.
 *
 * **Every row's expected level and bonus was restated by TICKET-SKL-04**, which moved both halves of
 * the derivation to `ROUNDUP` (v4 systems/06). The weights and the stat line are untouched — those
 * are what the old sheet was read for and the new one agrees — so each row still asserts the same
 * derivation, now against the rounding the new workbook's cells actually contain. Where the old
 * expectation is worth keeping in view (`11.7` becoming `12`) the row says both numbers.
 *
 * **Validates: Concept 02; Concept 05 (`bonus_divider`); Concept 00 §7; v4 systems/06 gap 3**
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
    schemaVersion: 9,
    stats: SAMPLE_STATS.map(([id, abbreviation]) => stat(id, abbreviation)),
    skills,
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
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
  // The concept page's weights, with the level and bonus each one derives to under TICKET-SKL-04's
  // `ROUNDUP`. `weighted` is the page's own number — the sum the sheet shows before it rounds — and
  // it is carried here so the row states what changed rather than only what it now expects.
  const CASES: Array<{
    name: string;
    weights: Skill['statWeights'];
    weighted: number;
    level: number;
    bonus: number;
  }> = [
    {
      name: 'Charm',
      weights: [{ statId: 'char', weight: 0.3 }],
      weighted: 11.7,
      level: 12,
      bonus: 3,
    },
    {
      name: 'Trading',
      weights: [{ statId: 'char', weight: 0.3 }],
      weighted: 11.7,
      level: 12,
      bonus: 3,
    },
    {
      name: 'Brewing',
      weights: [{ statId: 'wis', weight: 0.3 }],
      weighted: 4.5,
      level: 5,
      bonus: 1,
    },
    {
      name: 'Black smithing',
      weights: [{ statId: 'str', weight: 0.2 }],
      weighted: 2.0,
      level: 2,
      bonus: 1,
    },
    {
      name: 'alchemy',
      weights: [{ statId: 'int', weight: 0.2 }],
      weighted: 1.6,
      level: 2,
      bonus: 1,
    },
  ];

  const skills = CASES.map((testCase, index) =>
    skill(`skill-${index}`, testCase.name, testCase.weights)
  );
  const { levels, bonuses } = calculateSkills(
    createConfig(skills),
    SAMPLE_VALUES,
    createCharacter()
  );

  it.each(CASES)(
    'reproduces $name — $weighted rounds up to level $level, bonus $bonus',
    ({ name, level, bonus }) => {
      const id = skills.find((candidate) => candidate.name === name)?.id as string;

      // Whole numbers on both sides now, so no `toBeCloseTo`: 39 × 0.3 is 11.700000000000001 in
      // binary floating point and the round-up settles it to 12 either way
      expect(levels[id]).toBe(level);
      expect(bonuses[id]).toBe(bonus);
    }
  );

  it('reproduces Persuasion, the one row with invested points — level 13.5, bonus 3', () => {
    // The concept page's `+1.5` for one starting pick. The invested→level conversion is 1:1 and
    // **provisional** here (TICKET-ARC-02 routes it through the point-buy curve), so the 1.5 is
    // supplied as the invested amount rather than derived from a pick.
    //
    // The page's 13.2 was 11.7 + 1.5; under SKL-04 it is ceil(11.7) + 1.5 = 13.5, and the half is
    // still there because the *invested* half is not what rounds.
    const persuasion = skill('persuasion', 'Persuasion', [{ statId: 'char', weight: 0.3 }]);
    const { levels, bonuses } = calculateSkills(
      createConfig([persuasion]),
      SAMPLE_VALUES,
      createCharacter({ persuasion: 1.5 })
    );

    expect(levels.persuasion).toBe(13.5);
    expect(bonuses.persuasion).toBe(3);
  });

  it('rounds the level up — a weighted 7.5 is level 8, and its bonus 2', () => {
    // The row that used to pin half-away-from-zero on the *bonus* (7.5 / 5 = 1.5 → 2). Under
    // SKL-04 the level rounds first, so the same weights now say 8, and 8 / 5 = 1.6 → 2 keeps the
    // bonus where the sheet had it by a different route.
    const perception = skill('perception', 'perception', [{ statId: 'char', weight: 0.5 }]);
    const { levels, bonuses } = calculateSkills(
      createConfig([perception]),
      { char: 15 },
      createCharacter()
    );

    expect(levels.perception).toBe(8);
    expect(bonuses.perception).toBe(2);
  });
});

describe('rounding up, twice (TICKET-SKL-04)', () => {
  /**
   * One skill, weighted so the composed stat lands the weighted sum exactly where a case wants it
   *
   * Both numbers together rather than one function each: the two halves of this ticket's rule are
   * `ceil` in different places, and a case that names the level usually has something to say about
   * the bonus too.
   */
  function probe(
    statValue: number,
    weight: number,
    invested = 0
  ): { level: FormulaResult; bonus: FormulaResult } {
    const probed = skill('probe', 'Probe', [{ statId: 'char', weight }]);
    const config = createConfig([probed]);
    const character = createCharacter({ probe: invested });
    const { levels, bonuses } = calculateSkills(config, { char: statValue }, character);

    return { level: levels.probe, bonus: bonuses.probe };
  }

  it.each([
    { weighted: '4.1 — just over', statValue: 41, expected: 5 },
    { weighted: '4.0 — exactly on the boundary', statValue: 40, expected: 4 },
    { weighted: '3.9 — just under', statValue: 39, expected: 4 },
  ])('rounds a weighted $weighted up to level $expected', ({ statValue, expected }) => {
    // Both sides of a boundary and exactly on it: only the whole number is left alone
    const { level } = probe(statValue, 0.1);

    expect(level).toBe(expected);
  });

  it.each([
    { at: '2.2 — just over', statValue: 11, expected: 3 },
    { at: '2.0 — exactly on the boundary', statValue: 10, expected: 2 },
    { at: '1.8 — just under', statValue: 9, expected: 2 },
  ])('rounds a bonus of $at up to $expected', ({ statValue, expected }) => {
    // level = ceil(statValue) = statValue here, so the boundary being tested is the divider's:
    // 11 / 5 = 2.2, 10 / 5 = 2 exactly, 9 / 5 = 1.8
    const { bonus } = probe(statValue, 1);

    expect(bonus).toBe(expected);
  });

  it('adds invested points after the ceil, which is not the same answer as before it', () => {
    // The order matters exactly here: ceil(0.5) + 0.5 = 1.5, where ceil(0.5 + 0.5) would be 1. A
    // bought half-point stays a half-point instead of being eaten by the rounding of the derived
    // part — the sheet's `ROUNDUP(…) + investedPoints`.
    const { level } = probe(5, 0.1, 0.5);

    expect(level).toBe(1.5);
  });

  it('rounds a negative level away from zero, not toward it', () => {
    // `Math.ceil(-1.5)` is -1; Excel's `ROUNDUP` — and a User formula spelling `roundup` — says -2.
    // A ruleset is free to weight a skill negatively, so the two answers are both reachable.
    const weighted = probe(-15, 0.1);
    // The bonus says it too: level -11 over the seeded divider is -2.2, which is -3 away from zero
    const divided = probe(-11, 1);

    expect(weighted.level).toBe(-2);
    expect(divided.bonus).toBe(-3);
  });

  it('settles binary noise before rounding up, the way the sheet does', () => {
    // 12 × 0.2 + 6 × 0.1 is 3.0000000000000004 in floating point and 3 in the sheet. Rounding up has
    // no tolerance for that on its own, so `roundAwayFromZero` settles to fifteen significant digits
    // first — Excel's own rule. Without it this duo skill reads a whole level higher than the
    // workbook, and a User formula spelling the same arithmetic would disagree with the sheet it
    // sits on (`evaluator.test.ts` pins that half).
    const duo = skill('duo', 'Duo', [
      { statId: 'char', weight: 0.2 },
      { statId: 'wis', weight: 0.1 },
    ]);
    const config = createConfig([duo]);
    const character = createCharacter();
    const { levels } = calculateSkills(config, { char: 12, wis: 6 }, character);

    expect(levels.duo).toBe(3);
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
    const config = createConfig([charm], { constants: [constant(2)] });
    const { levels, bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter());

    // Level 12 (ceil of 11.7) / 2 = 6, where the seeded 5 gives ceil(2.4) = 3. The dial is read
    // at 2 rather than the old 4 because rounding *up* makes 12 / 4 = 3 the same answer as the
    // seed's, and a restated expectation that no longer moves would stop being a check.
    expect(levels.charm).toBe(12);
    expect(bonuses.charm).toBe(6);
  });

  it('falls back to the seeded 5 when the ruleset defines no such constant', () => {
    const { bonuses } = calculateSkills(createConfig([charm]), SAMPLE_VALUES, createCharacter());

    expect(bonuses.charm).toBe(3);
  });

  it.each([0, -5, Number.NaN])('falls back to the seeded 5 rather than dividing by %s', (value) => {
    const config = createConfig([charm], { constants: [constant(value)] });
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter());

    // Infinity or NaN would be a worse answer than the seed (Concept 00 §7)
    expect(bonuses.charm).toBe(3);
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

    // 15 × 0.2 + 10 × 0.1 = 4, already whole, so the round-up leaves it alone
    expect(levels.cooking).toBe(4);
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
    // 12 / 5 = 2.4, which rounds up to 3 (it rounded down to 2 before TICKET-SKL-04)
    expect(bonuses.lore).toBe(3);
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

  it('adds invested points on top of the rounded-up weighted sum', () => {
    const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
    const { levels } = calculateSkills(
      createConfig([charm]),
      SAMPLE_VALUES,
      createCharacter({ charm: 3 })
    );

    // ceil(11.7) + 3 = 15, where adding first and rounding after would also be 15 — the case that
    // tells the two orders apart is in the SKL-04 block above
    expect(levels.charm).toBe(15);
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

    // The surviving row's 11.7, rounded up — the missing stat contributed nothing, not a 0 × 5
    expect(levels.charm).toBe(12);
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
    expect(levels.brewing).toBe(5);
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
    // The terms account for the value the level rounded up from, which is the property that lets
    // the sheet show them beside it without either number having to be recomputed. Cooking's sum is
    // already whole, so here they account for the level itself as well.
    expect(contributions.cooking.reduce((sum, row) => sum + row.contribution, 0)).toBe(
      levels.cooking
    );
  });

  it('keeps its fractions when the level rounds up away from them (TICKET-SKL-04)', () => {
    // A term is a weight times a stat and stays one — hiding the fraction would hide the ruleset,
    // which is why the round-up belongs to the level and not to the breakdown
    const scouting = skill('scouting', 'Scouting', [{ statId: 'wis', weight: 0.3 }]);
    const config = createConfig([scouting]);
    const character = createCharacter();

    const { levels, contributions } = calculateSkills(config, SAMPLE_VALUES, character);

    expect(contributions.scouting).toEqual([
      { statId: 'wis', weight: 0.3, statValue: 15, contribution: 4.5 },
    ]);
    expect(levels.scouting).toBe(5);
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
    // ceil(11.7) + 1.5 — the terms hold the 11.7, the level holds what became of it
    expect(levels.persuasion).toBe(13.5);
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
