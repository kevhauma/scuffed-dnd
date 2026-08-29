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
import type { Configuration, Constant, Skill, Stat } from '../../types/config';
import type { FormulaError, FormulaResult } from '../../types/formula';
import { formulaError, rootCause } from '../formula/errors';
import { calculateSkills } from './skillCalculator';

/**
 * A character wielding nothing — what every case below the gear describe holds
 *
 * The gear term is a **required** fourth parameter (TICKET-ITEM-01) so that no production caller can
 * grow a second default; a test still has to say which case it is making, and every row in this file
 * except the gear describe is about the level and the bonus rather than about equipment.
 */
const NO_GEAR: Record<string, number> = {};

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
    schemaVersion: 10,
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

function createCharacter(
  investedSkillPoints: Record<string, number> = {},
  focusSkillIds?: string[]
): Character {
  return {
    id: 'char1',
    name: 'Sample',
    configurationId: 'config1',
    raceIds: [],
    investedStatPoints: {},
    investedSkillPoints,
    currentResourceValues: {},
    experience: 0,
    inventory: { equippedItems: {}, miscItems: [], composedItems: [] },
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    // Absent unless a test names picks, which is what an untouched character is (TICKET-SKL-05)
    ...(focusSkillIds ? { focusSkillIds } : {}),
  };
}

/**
 * The sheet's own focus dials, as this ticket's fixture rather than as seed data
 *
 * *Enhanced scaling* holds chosen **1.5** / others **0.3**; under v4 D7 the corpus gets them in the
 * data pass, so the engine's tests carry their own copy — which is what the criterion asks for.
 */
const FOCUS_DIALS: Constant[] = [
  { id: 'fc', name: 'focus_chosen', displayName: 'Focus chosen', description: '', value: 1.5 },
  { id: 'fo', name: 'focus_other', displayName: 'Focus other', description: '', value: 0.3 },
];

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
    createCharacter(),
    NO_GEAR
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
      createCharacter({ persuasion: 1.5 }),
      NO_GEAR
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
      createCharacter(),
      NO_GEAR
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
    const { levels, bonuses } = calculateSkills(config, { char: statValue }, character, NO_GEAR);

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
    const { levels } = calculateSkills(config, { char: 12, wis: 6 }, character, NO_GEAR);

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
    const { levels, bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), NO_GEAR);

    // Level 12 (ceil of 11.7) / 2 = 6, where the seeded 5 gives ceil(2.4) = 3. The dial is read
    // at 2 rather than the old 4 because rounding *up* makes 12 / 4 = 3 the same answer as the
    // seed's, and a restated expectation that no longer moves would stop being a check.
    expect(levels.charm).toBe(12);
    expect(bonuses.charm).toBe(6);
  });

  it('falls back to the seeded 5 when the ruleset defines no such constant', () => {
    const { bonuses } = calculateSkills(
      createConfig([charm]),
      SAMPLE_VALUES,
      createCharacter(),
      NO_GEAR
    );

    expect(bonuses.charm).toBe(3);
  });

  it.each([0, -5, Number.NaN])('falls back to the seeded 5 rather than dividing by %s', (value) => {
    const config = createConfig([charm], { constants: [constant(value)] });
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), NO_GEAR);

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
      createCharacter(),
      NO_GEAR
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
      createCharacter({ lore: 12 }),
      NO_GEAR
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
      createCharacter(),
      NO_GEAR
    );

    expect(levels.lore).toBe(0);
    expect(bonuses.lore).toBe(0);
  });

  it('adds invested points on top of the rounded-up weighted sum', () => {
    const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
    const { levels } = calculateSkills(
      createConfig([charm]),
      SAMPLE_VALUES,
      createCharacter({ charm: 3 }),
      NO_GEAR
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
    const { levels } = calculateSkills(
      createConfig([charm]),
      SAMPLE_VALUES,
      createCharacter(),
      NO_GEAR
    );

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

    const { levels } = calculateSkills(
      createConfig([charm]),
      { char: broken },
      createCharacter(),
      NO_GEAR
    );

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
      createCharacter(),
      NO_GEAR
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

    const { levels } = calculateSkills(createConfig(skills), values, createCharacter(), NO_GEAR);

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
      createCharacter(),
      NO_GEAR
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

    const { levels, contributions } = calculateSkills(config, SAMPLE_VALUES, character, NO_GEAR);

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
      createCharacter({ persuasion: 1.5 }),
      NO_GEAR
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
      createCharacter(),
      NO_GEAR
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
      createCharacter(),
      NO_GEAR
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
      createCharacter({ pure: 3 }),
      NO_GEAR
    );

    expect(contributions.pure).toEqual([]);
  });
});

describe('the focus multiplier (TICKET-SKL-05)', () => {
  /** Brewing at the concept page's weights: Wis 15 × 0.3 = 4.5 before anything multiplies it */
  const brewing = skill('brewing', 'Brewing', [{ statId: 'wis', weight: 0.3 }]);
  const arcane = skill('arcane', 'Arcane', [{ statId: 'wis', weight: 0.3 }]);

  const dialled = createConfig([brewing, arcane], { constants: FOCUS_DIALS });

  it('leaves every skill exactly as it was for a ruleset that states neither dial', () => {
    const undialled = createConfig([brewing]);
    const picky = createCharacter({}, ['brewing', 'brewing', 'brewing']);

    // ceil(4.5) — the pre-focus answer, unchanged even for a character who has picked three times
    expect(calculateSkills(undialled, SAMPLE_VALUES, picky, NO_GEAR).levels.brewing).toBe(5);
  });

  it('computes a character with no picks at 0.9 everywhere', () => {
    const { levels, focus } = calculateSkills(dialled, SAMPLE_VALUES, createCharacter(), NO_GEAR);

    // 4.5 × 0.9 = 4.05, which rounds up to 5 — the same *level* as the unchosen ruleset above by
    // coincidence of the ceiling, and a different number underneath it
    expect(focus.brewing?.multiplier).toBeCloseTo(0.9, 10);
    expect(levels.brewing).toBe(5);
  });

  it('reproduces the three tiers on one skill: unchosen 0.9, chosen 2.1, chosen twice 3.3', () => {
    const picks = ['arcane', 'brewing', 'arcane'];
    const { levels, focus } = calculateSkills(
      dialled,
      SAMPLE_VALUES,
      createCharacter({}, picks),
      NO_GEAR
    );

    // Brewing named once: 4.5 × 2.1 = 9.45 → 10
    expect(focus.brewing?.multiplier).toBeCloseTo(2.1, 10);
    expect(levels.brewing).toBe(10);

    // Arcane named twice — duplicates stack: 4.5 × 3.3 = 14.85 → 15
    expect(focus.arcane?.multiplier).toBeCloseTo(3.3, 10);
    expect(levels.arcane).toBe(15);
  });

  it('adds invested points after the multiplied-and-ceiled term, which changes the answer', () => {
    const { levels } = calculateSkills(
      dialled,
      SAMPLE_VALUES,
      createCharacter({ brewing: 3 }, ['brewing']),
      NO_GEAR
    );

    /*
     * `ceil(4.5 × 2.1) + 3` = 13, and every other order of the same three operations gives
     * something else:
     *   invested inside the multiply — ceil((4.5 + 3) × 2.1) = 16
     *   rounded before the multiply  — ceil(4.5) × 2.1 + 3    = 13.5
     * which is what makes this row a check on the *order* rather than on the arithmetic.
     */
    expect(levels.brewing).toBe(13);
  });

  it('reports what the multiplier added, so the breakdown still sums to what rounds', () => {
    const { focus, contributions } = calculateSkills(
      dialled,
      SAMPLE_VALUES,
      createCharacter({}, ['brewing']),
      NO_GEAR
    );

    const weighted = contributions.brewing?.[0]?.contribution ?? 0;

    expect(weighted).toBe(4.5);
    // 4.5 × 2.1 − 4.5 = 4.95: the term a surface renders as `focus × 2.1  +4.95`
    expect(focus.brewing?.contribution).toBeCloseTo(4.95, 10);
  });

  it('leaves a failed skill without a focus term, as it leaves it without contributions', () => {
    const values = {
      ...SAMPLE_VALUES,
      wis: formulaError('undefined-variable', 'Undefined variable: NOPE'),
    };

    const { focus, levels } = calculateSkills(
      dialled,
      values,
      createCharacter({}, ['brewing']),
      NO_GEAR
    );

    expect(levels.brewing).toMatchObject({ formulaError: true });
    expect(focus.brewing).toBeUndefined();
  });

  it('ignores a pick naming a skill the ruleset does not define', () => {
    // Refused at every write, so this is a hand-edited file rather than a state the app makes —
    // and it multiplies nothing, because the calculator walks the ruleset's skills
    const { levels } = calculateSkills(
      dialled,
      SAMPLE_VALUES,
      createCharacter({}, ['nonesuch', 'nonesuch', 'nonesuch']),
      NO_GEAR
    );

    expect(levels.brewing).toBe(5);
  });
});

/**
 * The gear term — `ROUNDUP(level / 5, 0) + gear` (v4 systems/06 gap 5, TICKET-ITEM-01)
 *
 * What the equipped templates are worth per skill arrives already totalled, so these cases are about
 * exactly one thing: **where** it lands. On the bonus, outside the round-up, and never on the level.
 */
describe('the equipped templates skill bonus', () => {
  // Charm off the verified table: 39 × 0.3 = 11.7, which rounds up to 12, and 12 / 5 rounds up to 3
  const charm = skill('charm', 'Charm', [{ statId: 'char', weight: 0.3 }]);
  const config = createConfig([charm]);

  it('adds to the bonus and leaves the level alone', () => {
    const { levels, bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), {
      charm: 2,
    });

    expect(levels.charm).toBe(12);
    expect(bonuses.charm).toBe(5);
  });

  it('subtracts when the gear is a hindrance', () => {
    const { levels, bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), {
      charm: -1,
    });

    expect(levels.charm).toBe(12);
    expect(bonuses.charm).toBe(2);
  });

  it('lands outside the round-up rather than inside the divide', () => {
    // ceil(12 / 5) + 2 = 5. Folded into the divide it would be ceil(14 / 5) = 3 — a whole point
    // short, and silently, which is the ordering this criterion exists to pin
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), { charm: 2 });

    expect(bonuses.charm).toBe(5);
  });

  it('is not multiplied by the focus picks, which belong to the level', () => {
    const dialled = createConfig([charm], { constants: FOCUS_DIALS });

    // Focus moves the level (11.7 × 2.1 = 24.57 → 25, so ceil(25 / 5) = 5) and the gear is added
    // whole on top of the bonus that comes out
    const { levels, bonuses } = calculateSkills(
      dialled,
      SAMPLE_VALUES,
      createCharacter({}, ['charm']),
      { charm: 2 }
    );

    expect(levels.charm).toBe(25);
    expect(bonuses.charm).toBe(7);
  });

  it('leaves a skill no template names exactly as it was', () => {
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), {
      somethingElse: 9,
    });

    expect(bonuses.charm).toBe(3);
  });

  it('computes a ruleset whose templates carry no vectors exactly as it did before', () => {
    const { bonuses } = calculateSkills(config, SAMPLE_VALUES, createCharacter(), NO_GEAR);

    expect(bonuses.charm).toBe(3);
  });

  it('reports a failed level rather than a confident total resting on nothing', () => {
    const broken: FormulaError = formulaError('undefined-variable', 'Undefined variable: NOPE');

    const { bonuses } = calculateSkills(config, { char: broken }, createCharacter(), { charm: 2 });

    expect(bonuses.charm).toMatchObject({ formulaError: true });
  });
});
