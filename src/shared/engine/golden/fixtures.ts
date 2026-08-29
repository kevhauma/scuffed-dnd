/**
 * Golden fixtures — every derivation the source spreadsheet confirms, as data
 *
 * The concept pages under `docs/excel export summary/concepts/` carry a body of ✅-confirmed
 * derivations with exact inputs and outputs, each read out of the live sheet cell by cell. They
 * live here as typed rows so that `golden.test.ts` can run the **real engine** over the **real
 * corpus** (`docs/imports/ducklets.json`) and check every one of them at once.
 *
 * Each row carries its {@link GoldenCitation}, which the suite renders into the test name and the
 * failure message. That is the point of the format: a failure tells you which page, which section
 * and — where the page names one — which cell range to go and re-read.
 *
 * **A failing fixture is never fixed by editing the fixture.** See [README.md](./README.md).
 *
 * 🔍-inferred values are included but carry `inferred: true`: consistent with the sheet, not proven
 * by it. The suite reports them separately so "confirmed" never quietly comes to mean "plausible".
 *
 * This module imports **types, and the frozen constants declared beside them** (`STAT_AFFINITY`
 * since TICKET-ARC-04 — a fixture naming an affinity references the constant like every other call
 * site). It is data, and keeping it that way is what lets it sit inside `engine/` without reaching
 * for the stores and services the builder in `golden.test.ts` needs (`engine/` is pure — see
 * `.claude/skills/coding-conventions/SKILL.md`).
 *
 * **Validates: Concepts 01, 02, 03, 04, 05, 06, 07, 08, 20; spec §12**
 */

import type { StatAffinity } from '../../types/config';
import { STAT_AFFINITY } from '../../types/config';

/**
 * Where a fixture's expected value comes from
 *
 * `range` is present only where the page itself names a cell range. Inventing one to make the
 * citations look uniform would defeat the purpose — a citation you cannot follow is worse than an
 * honest "the page states it, without a range".
 */
export interface GoldenCitation {
  /** The concept page, as it titles itself — e.g. `02 · Skill` */
  concept: string;
  /** The section or table within it — e.g. `Derivation ✅` */
  section: string;
  /** The sheet range the page cites, where it cites one — e.g. `Charactersheet!E9` */
  range?: string;
  /**
   * What kind of document `concept` names, when it is not a concept page — `v4` for a
   * `docs/v4.0_sheet_parity/systems/` document.
   *
   * v4.0's system documents supersede the concept pages wherever the new workbook changed something
   * (v4 D1), so a fixture whose expected value comes from one has to **say so**. A new number left
   * under an old citation is the single edit this file exists to prevent (see the README): the
   * citation is what a reader follows to check the number, and one that leads to a page not stating
   * it is worse than none.
   */
  document?: string;
}

/** What every fixture row carries, whatever it asserts */
export interface GoldenFixture {
  /** What this row asserts; the suite uses it as the test name */
  name: string;
  citation: GoldenCitation;
  /**
   * 🔍 — the expected value is *inferred* from the sheet rather than read out of it.
   *
   * Concept 02's `+1.5` invested contribution is the case this exists for: the page marks it 🔍 and
   * leaves the real points→level conversion open. Pinning it keeps the number honest about where it
   * came from, and makes the day the User settles it a one-row edit with a new citation.
   */
  inferred?: boolean;
}

/** Render a citation the way the suite prints it in a test name and a failure message */
export function describeCitation({ concept, section, range, document }: GoldenCitation): string {
  const kind = document ?? 'Concept';
  const cited = range === undefined ? '' : ` (${range})`;

  return `${kind} ${concept} § ${section}${cited}`;
}

// ---------------------------------------------------------------------------------------------
// The sample character's stat line (Concept 01)
// ---------------------------------------------------------------------------------------------

/** One of the sample character's composed stat values */
export interface StatValueFixture extends GoldenFixture {
  statId: string;
  expected: number;
}

/**
 * Bickuss Dickuss's stat line, as the sheet's Charactersheet shows it
 *
 * Confirmed values, composed through the real `calculateCharacter`. How the line *splits* between
 * race base and point-buy spend is not in the export — see the README — so the suite installs it as
 * the sample race's stat block and pins the point-buy multiplier separately, in
 * {@link pointBuyFixtures}.
 */
export const statLineFixtures: readonly StatValueFixture[] = [
  { name: 'Strenght is 10', statId: 'stat-strenght', expected: 10 },
  { name: 'Dex is 11', statId: 'stat-dex', expected: 11 },
  { name: 'Con is 12', statId: 'stat-con', expected: 12 },
  { name: 'Int is 8', statId: 'stat-int', expected: 8 },
  { name: 'Wis is 15', statId: 'stat-wis', expected: 15 },
  { name: 'Char is 39', statId: 'stat-char', expected: 39 },
  { name: 'Health is 7', statId: 'stat-health', expected: 7 },
  { name: 'Mana is 310', statId: 'stat-mana', expected: 310 },
  { name: 'Speed is 30', statId: 'stat-speed', expected: 30 },
].map((row) => ({
  ...row,
  citation: { concept: '01 · Stat', section: 'Sample values ✅' },
}));

/**
 * The same nine numbers as one stat block, keyed by stat id
 *
 * Derived from the rows above rather than restated, so there is exactly one place the sample
 * character's line is written down. The suite installs this as the sample race's block and then
 * asserts the rows back out through `calculateCharacter` — which is not circular: what it proves is
 * that the composition (blend → point-buy gain → equipment → clamp → round) returns the block
 * untouched at zero investment, and everything genuinely derived from it — APT, the total, every
 * skill level, every roll input — is checked against numbers the sheet supplies independently.
 */
export const SAMPLE_STAT_LINE: Readonly<Record<string, number>> = Object.fromEntries(
  statLineFixtures.map(({ statId, expected }) => [statId, expected])
);

/**
 * The six-core-only total for the sample character
 *
 * Two confirmed facts multiplied out: the stat line above, and `counts_toward_total` being the six
 * core stats only. Health, Mana and Speed contribute nothing, which is the whole reason the flag is
 * data — Speed 30 and Mana 310 would otherwise swamp every total in the ruleset.
 */
export const sampleStatTotal: StatValueFixture = {
  name: 'the six core stats total 95, with Health, Mana and Speed excluded',
  statId: 'statTotal',
  expected: 10 + 11 + 12 + 8 + 15 + 39,
  citation: { concept: '01 · Stat', section: 'counts_toward_total — confirmed derivation ✅' },
};

// ---------------------------------------------------------------------------------------------
// Skills (Concept 02)
// ---------------------------------------------------------------------------------------------

/** One skill's two numbers on the sample character */
export interface SkillFixture extends GoldenFixture {
  /** The skill's name in the corpus — the sheet's own spelling, typos included */
  skillName: string;
  /** Points the Player put into this skill; the level's `+ invested` term, 1:1 today */
  invested: number;
  expectedLevel: number;
  expectedBonus: number;
}

/**
 * Concept 02's verified table, plus the two rows that pin its rounding rule
 *
 * `level = Σ(weight × stat) + invested`, `bonus = round(level / const.bonus_divider)` with the
 * divider at 5. Rounding is half-**away-from-zero**, which is Excel's `ROUND` rather than
 * JavaScript's `Math.round` — the `perception` row at exactly 7.5 is the case that tells them apart.
 *
 * **Two settlements are recorded in these rows** (both in the README at length):
 *
 * - Concept 02's `Persuasion 13.2 → 3` is **Charm's** number. The page has Persuasion at `Char × 0.3`;
 *   the live `Skills!D31:G31` has `Char × 0.2 + Strenght × 0.1`, which is 8.8 at Char 39. The sheet
 *   wins, so the derivation the page verified is pinned on the skill whose weights actually produce
 *   it, and Persuasion is pinned at what the sheet says.
 * - The `+1.5` for one starting pick is 🔍, not ✅ — Concept 02's own open question.
 */
export const skillFixtures: readonly SkillFixture[] = [
  {
    name: 'Charm — CHA 0.3 at Char 39',
    skillName: 'Charm',
    invested: 0,
    expectedLevel: 11.7,
    expectedBonus: 2,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'Trading — CHA 0.3 at Char 39',
    skillName: 'Trading',
    invested: 0,
    expectedLevel: 11.7,
    expectedBonus: 2,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'Brewing — WIS 0.3 at Wis 15',
    skillName: 'Brewing',
    invested: 0,
    expectedLevel: 4.5,
    expectedBonus: 1,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'Black smithing — STR 0.2 at Strenght 10',
    skillName: 'Black smithing',
    invested: 0,
    expectedLevel: 2,
    expectedBonus: 0,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'alchemy — INT 0.2 at Int 8',
    skillName: 'alchemy',
    invested: 0,
    expectedLevel: 1.6,
    expectedBonus: 0,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'Charm with one starting pick — 11.7 + 1.5, the page’s "Persuasion" row',
    skillName: 'Charm',
    invested: 1.5,
    expectedLevel: 13.2,
    expectedBonus: 3,
    inferred: true,
    citation: { concept: '02 · Skill', section: 'Derivation ✅' },
  },
  {
    name: 'perception at exactly 7.5 rounds to 2, not 1',
    skillName: 'perception',
    invested: 3,
    expectedLevel: 7.5,
    expectedBonus: 2,
    citation: { concept: '02 · Skill', section: 'Derivation ✅ — "Rounding is half-up ✅"' },
  },
  {
    name: 'Persuasion — the live sheet’s CHA 0.2 + STR 0.1, not the page’s CHA 0.3',
    skillName: 'Persuasion',
    invested: 0,
    expectedLevel: 8.8,
    expectedBonus: 2,
    citation: { concept: '02 · Skill', section: 'Seed weights ✅', range: 'Skills!D31:G31' },
  },
];

/**
 * `const.bonus_divider` as a balance dial (Concept 02's first editing scenario)
 *
 * The same six skills at divider 4 instead of 5, with no investment. Two rows move and four do not,
 * which is what makes this a real check rather than a restatement: Charm 2 → 3, and Black smithing
 * 0 → 1 — the latter landing on exactly 0.5, so it also re-pins half-away-from-zero at the dial's
 * new setting.
 */
export const bonusDividerFixtures: readonly SkillFixture[] = [
  { skillName: 'Charm', expectedLevel: 11.7, expectedBonus: 3 },
  { skillName: 'Trading', expectedLevel: 11.7, expectedBonus: 3 },
  { skillName: 'Brewing', expectedLevel: 4.5, expectedBonus: 1 },
  { skillName: 'Black smithing', expectedLevel: 2, expectedBonus: 1 },
  { skillName: 'alchemy', expectedLevel: 1.6, expectedBonus: 0 },
  { skillName: 'perception', expectedLevel: 4.5, expectedBonus: 1 },
].map((row) => ({
  ...row,
  name: `${row.skillName} — level ${row.expectedLevel} becomes bonus ${row.expectedBonus}`,
  invested: 0,
  citation: {
    concept: '02 · Skill',
    section: 'Editing scenarios — "Make bonuses grow faster"',
    range: 'Calculator "Bonus divider"',
  },
}));

/** What `const.bonus_divider` is turned down to for {@link bonusDividerFixtures} */
export const DIALLED_BONUS_DIVIDER = 4;

// ---------------------------------------------------------------------------------------------
// APT — the sheet's one derived stat (Concepts 01, 05)
// ---------------------------------------------------------------------------------------------

/** A Speed value and the APT it derives */
export interface AptFixture extends GoldenFixture {
  speed: number;
  expected: number;
}

/**
 * `apt = max(1, round(stats.speed / const.apt_value))`, with `apt_value = 30`
 *
 * The floor is the interesting half of the formula and the reason it is not plain division: the
 * sheet's `IF(… <= 0, 1, …)` says nobody gets fewer than one attack however slow they are.
 */
export const aptFixtures: readonly AptFixture[] = [
  {
    name: 'the sample character at Speed 30 gets 1 attack',
    speed: 30,
    expected: 1,
    citation: {
      concept: '05 · Constant',
      section: 'APT — Attacks Per Turn ✅',
      range: 'Charactersheet!E9',
    },
  },
  {
    name: 'Speed 22 still gets 1 — the creature call sheet’s value',
    speed: 22,
    expected: 1,
    inferred: true,
    citation: { concept: '05 · Constant', section: 'Open questions' },
  },
  {
    name: 'Speed 0 gets 1, because the floor is what the IF is for',
    speed: 0,
    expected: 1,
    citation: {
      concept: '05 · Constant',
      section: 'APT — Attacks Per Turn ✅',
      range: 'Charactersheet!E9',
    },
  },
  {
    name: 'Speed 75 gets 3 — 2.5 rounds away from zero, as Excel does',
    speed: 75,
    expected: 3,
    citation: {
      concept: '05 · Constant',
      section: 'APT — Attacks Per Turn ✅',
      range: 'Calculator!Q2',
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Point buy (Concepts 03, 06)
// ---------------------------------------------------------------------------------------------

/**
 * What a spend buys, at one affinity and one dream level
 *
 * `dreamLevel` is explicit on every row since TICKET-ARC-04, because a gain is no longer a function
 * of the spend alone: `expected` is what a *character* at that dream level gains, table value and
 * dream term together. Stating the level per row is what keeps the two halves legible — the table's
 * own number is `expected` minus (or over) the term the affinity names.
 */
export interface PointBuyFixture extends GoldenFixture {
  points: number;
  affinity: StatAffinity;
  /** How far the character stands in their dream; 1 is the neutral level (RES-04) */
  dreamLevel: number;
  expected: number;
}

/**
 * Concept 06's seed table, at the rows that carry an argument — through the v4 gain formula
 *
 * The 15-point row is the one the whole archetype concept rests on — the table's **5 / 7 / 12**, a
 * 2.4× spread between a stat your archetype ignores and one it is built around. The 9-point `sub`
 * cell is the sheet's own anomaly (65/14, where every neighbour is an integer), carried across
 * deliberately rather than rounded away, and pinned here so that "fix the 4.642857 cell" stays a
 * decision somebody makes rather than something that quietly happens.
 *
 * **The `expected` numbers moved with TICKET-ARC-04, and the *table* rows' citations did not.** The
 * curve is byte-identical to what the old workbook held and the new one still holds (v4 systems/05:
 * the "new integer table" was display rounding), so Concept 06 remains where each **table value**
 * comes from — and the two rows that are still nothing but a table cell (`non` at 15, `main` at 0)
 * keep that citation. What changed is the formula reading it: `main × dreamLevel`,
 * `sub + dreamLevel`. Every row whose number now contains that term **cites v4 systems/05
 * instead**, because Concept 06 does not state it: a new expected value under an old citation is
 * the one edit this file exists to prevent, and it is not made less wrong by the number being
 * right.
 *
 * This is the README's "never fix a failing fixture by editing the fixture" exception in its
 * intended form: the derivation was deliberately changed by a ticket, so the rows were re-derived
 * rather than re-fitted, and the citation moved with the number.
 */
const POINT_BUY_TABLE: GoldenCitation = {
  concept: '06 · Curve',
  section: 'Seed curve: point-buy ✅',
};

/** Where the dream term comes from — the formulas the new workbook writes per (stat × archetype) */
const DREAM_TERM: GoldenCitation = {
  document: 'v4',
  concept: 'systems/05 · Archetypes',
  section: 'Dream level enters the gain formula',
};

export const pointBuyFixtures: readonly PointBuyFixture[] = [
  {
    name: '15 points on a non-type stat buy 5, which the dream never reaches',
    points: 15,
    affinity: STAT_AFFINITY.NON,
    dreamLevel: 1,
    expected: 5,
    citation: POINT_BUY_TABLE,
  },
  {
    name: '15 points on a sub-type stat buy the table’s 7, plus a dream level of 1',
    points: 15,
    affinity: STAT_AFFINITY.SUB,
    dreamLevel: 1,
    expected: 8,
    citation: DREAM_TERM,
  },
  {
    name: '15 points on a main-type stat buy 12 at dream 1 — the 2.4× spread',
    points: 15,
    affinity: STAT_AFFINITY.MAIN,
    dreamLevel: 1,
    // Still the table's own cell: the neutral level multiplies it by one
    expected: 12,
    citation: POINT_BUY_TABLE,
  },
  {
    name: '15 points on a main-type stat buy 24 at dream 2 — the whole column doubles',
    points: 15,
    affinity: STAT_AFFINITY.MAIN,
    dreamLevel: 2,
    expected: 24,
    citation: DREAM_TERM,
  },
  {
    name: '9 points on a sub-type stat buy the sheet’s 65/14 anomaly, unrounded, plus dream 1',
    points: 9,
    affinity: STAT_AFFINITY.SUB,
    dreamLevel: 1,
    expected: 5.64285714285714,
    // The anomaly is Concept 06's (`Seed curve: point-buy ✅ — the ⚠️ cell`); the `+1` on top of it
    // is systems/05's, and a row carrying both cites the one a reader could not otherwise find
    citation: DREAM_TERM,
  },
  {
    name: 'spending nothing on a main-type stat still buys the column’s fractional 0.75',
    points: 0,
    affinity: STAT_AFFINITY.MAIN,
    dreamLevel: 1,
    // The generator's own value at key 0, which ARC-02 used to override and ARC-04 stopped
    expected: 0.75,
    citation: POINT_BUY_TABLE,
  },
  {
    name: 'spending nothing on a sub-type stat buys the dream level itself',
    points: 0,
    affinity: STAT_AFFINITY.SUB,
    dreamLevel: 3,
    expected: 3,
    citation: DREAM_TERM,
  },
];

/** The generator Concept 06 confirms for the whole `main` column */
export const POINT_BUY_MAIN_GENERATOR = {
  name: 'the main column is 0.75 × (points + 1) on every row',
  citation: { concept: '06 · Curve', section: 'Seed curve: point-buy ✅' },
  factor: 0.75,
} as const;

// ---------------------------------------------------------------------------------------------
// Races: stat totals and the hybrid blend (Concepts 01, 04)
// ---------------------------------------------------------------------------------------------

/** One race's six-core total, on a character with nothing invested */
export interface RaceTotalFixture extends GoldenFixture {
  raceName: string;
  expected: number;
}

/**
 * Concept 01's seven independent confirmations of the six-core-only rule
 *
 * Seven rather than the five the ticket lists: the page confirms Monolith and Gods too, and they
 * are the rows where a tenth stat sneaking into the total would be most obvious.
 */
export const raceTotalFixtures: readonly RaceTotalFixture[] = [
  { raceName: 'human', expected: 60 },
  { raceName: 'elf', expected: 64 },
  { raceName: 'dwarf', expected: 60 },
  { raceName: 'Raccoon', expected: 59 },
  { raceName: 'Demon', expected: 90 },
  { raceName: 'Monolith', expected: 1800 },
  { raceName: 'Gods', expected: 1920 },
].map((row) => ({
  ...row,
  name: `${row.raceName} totals ${row.expected}`,
  citation: {
    concept: '01 · Stat',
    section: 'counts_toward_total — confirmed derivation ✅',
    range: 'Creature stats!B4:K14',
  },
}));

/** One stat of a two-race blend */
export interface RaceBlendFixture extends GoldenFixture {
  raceNames: readonly [string, string];
  statId: string;
  expected: number;
}

/**
 * `stat = roundup(race_a.stat + race_b.stat) / 2` (Concept 04)
 *
 * The odd sums are the rows that matter — `roundup` is Excel's away-from-zero, so 19/2 is 10 rather
 * than the 9 a naive `Math.round` on a `.5` would give on the negative side, and rather than the 9
 * a floor would give here. Speed 45/2 = 22.5 → 23 is the same case one stat further down.
 *
 * The same-race blend is the sheet's own single-race character: the wizard defaults both dropdowns
 * to one race, so `(a + a) / 2 = a` is not a special case but the identity falling out of the
 * arithmetic.
 */
const HUMAN_ELF: readonly [string, string] = ['human', 'elf'];

export const raceBlendFixtures: readonly RaceBlendFixture[] = [
  {
    name: 'human × elf — Strenght 10 + 9 = 19, blended up to 10',
    raceNames: HUMAN_ELF,
    statId: 'stat-strenght',
    expected: 10,
  },
  {
    name: 'human × elf — Dex 10 + 12 = 22, blended to 11',
    raceNames: HUMAN_ELF,
    statId: 'stat-dex',
    expected: 11,
  },
  {
    name: 'human × elf — Char 10 + 9 = 19, blended up to 10',
    raceNames: HUMAN_ELF,
    statId: 'stat-char',
    expected: 10,
  },
  {
    name: 'human × elf — Speed 20 + 25 = 45, blended up to 23',
    raceNames: HUMAN_ELF,
    statId: 'stat-speed',
    expected: 23,
  },
  {
    name: 'human × elf — Mana 100 + 200 = 300, blended to 150',
    raceNames: HUMAN_ELF,
    statId: 'stat-mana',
    expected: 150,
  },
].map((row) => ({
  ...row,
  citation: { concept: '04 · Creature', section: 'Hybrid races ✅' },
}));

// ---------------------------------------------------------------------------------------------
// The dice ladder (Concept 07)
// ---------------------------------------------------------------------------------------------

/** One value decomposed down the `[20, 12, 6]` ladder */
export interface LadderFixture extends GoldenFixture {
  input: number;
  /** One count per rung, in ladder order — D20, D12, D6 */
  expectedCounts: readonly number[];
  expectedFlat: number;
  /** What the sheet prints, `showZeroTerms` being true */
  expectedNotation: string;
}

/**
 * Concept 07's six confirmed decompositions, notation included
 *
 * The page calls this the best-confirmed mechanic in the ruleset, and these are the six independent
 * sightings behind that. Greedy, largest die first, remainder flat — and `0D20` is *printed*,
 * because the sheet prints it. {@link extraLadderFixtures} adds two more the page's own table
 * misses.
 */
const conceptSevenLadderFixtures: readonly LadderFixture[] = [
  {
    name: '10 — character melee at Str 10',
    input: 10,
    expectedCounts: [0, 0, 1],
    expectedFlat: 4,
    expectedNotation: '0D20 + 0D12 + 1D6 + 4',
  },
  {
    name: '11 — character ranged at Dex 11',
    input: 11,
    expectedCounts: [0, 0, 1],
    expectedFlat: 5,
    expectedNotation: '0D20 + 0D12 + 1D6 + 5',
  },
  {
    name: '16 — character endure',
    input: 16,
    expectedCounts: [0, 1, 0],
    expectedFlat: 4,
    expectedNotation: '0D20 + 1D12 + 0D6 + 4',
  },
  {
    name: '18 — character evasion',
    input: 18,
    expectedCounts: [0, 1, 1],
    expectedFlat: 0,
    expectedNotation: '0D20 + 1D12 + 1D6 + 0',
  },
  {
    name: '32 — creature melee at Str 32',
    input: 32,
    expectedCounts: [1, 1, 0],
    expectedFlat: 0,
    expectedNotation: '1D20 + 1D12 + 0D6 + 0',
  },
  {
    name: '39 — creature endure',
    input: 39,
    expectedCounts: [1, 1, 1],
    expectedFlat: 1,
    expectedNotation: '1D20 + 1D12 + 1D6 + 1',
  },
].map((row) => ({
  ...row,
  citation: {
    concept: '07 · Dice Ladder',
    section: 'The mechanic ✅',
    range: 'Calculator!I16:L16',
  },
}));

/**
 * Two more confirmed decompositions, from Concept 08's table rather than Concept 07's
 *
 * The roll page's *sample creature* column carries a ranged roll at input 25 and an evasion roll at
 * input 12 that the ladder page's own six-row table does not list. They are the same mechanic
 * confirmed on the same sheet, so leaving them out would be losing evidence to a page boundary.
 */
const extraLadderFixtures: readonly LadderFixture[] = [
  {
    name: '25 — creature ranged',
    input: 25,
    expectedCounts: [1, 0, 0],
    expectedFlat: 5,
    expectedNotation: '1D20 + 0D12 + 0D6 + 5',
  },
  {
    name: '12 — creature evasion',
    input: 12,
    expectedCounts: [0, 1, 0],
    expectedFlat: 0,
    expectedNotation: '0D20 + 1D12 + 0D6 + 0',
  },
].map((row) => ({
  ...row,
  citation: {
    concept: '08 · Roll Definition',
    section: 'Confirmed outputs ✅',
    range: 'Charactersheet!D12:H14',
  },
}));

/** Every confirmed decomposition, from both pages */
export const ladderFixtures: readonly LadderFixture[] = [
  ...conceptSevenLadderFixtures,
  ...extraLadderFixtures,
];

/** The die sizes the Calculator shows as a literal row */
export const LADDER_DIE_SIZES: readonly number[] = [20, 12, 6];

// ---------------------------------------------------------------------------------------------
// Roll definitions (Concept 08)
// ---------------------------------------------------------------------------------------------

/** One roll, end to end: the character's stat becomes an input becomes a pool */
export interface RollFixture extends GoldenFixture {
  rollName: string;
  expectedInput: number;
  expectedNotation: string;
}

/**
 * The two roll inputs Concept 08 confirms — and deliberately only those two
 *
 * `evasion` and `endure` are absent on purpose: the sheet reads 18 against Dex 11 and 16 against
 * Con 12, and the extra 7 and 4 are Concept 08's open question. The corpus ships the raw stat and
 * says it is short, so pinning those here would pin a gap as though it were a derivation.
 */
export const rollFixtures: readonly RollFixture[] = [
  {
    name: 'mele reads Strenght 10 and throws 0D20 + 0D12 + 1D6 + 4',
    rollName: 'mele',
    expectedInput: 10,
    expectedNotation: '0D20 + 0D12 + 1D6 + 4',
  },
  {
    name: 'Ranged reads Dex 11 and throws 0D20 + 0D12 + 1D6 + 5',
    rollName: 'Ranged',
    expectedInput: 11,
    expectedNotation: '0D20 + 0D12 + 1D6 + 5',
  },
].map((row) => ({
  ...row,
  citation: {
    concept: '08 · Roll Definition',
    section: 'Confirmed outputs ✅ / Input expressions',
    range: 'Charactersheet!D12:H14',
  },
}));

// ---------------------------------------------------------------------------------------------
// Resource pools (Concept 20) — behaviour, not derivation
// ---------------------------------------------------------------------------------------------

/** A resource stat's maximum and the current value seeded against it */
export interface PoolFixture extends GoldenFixture {
  statId: string;
  expectedMax: number;
}

/**
 * Health and Mana as **pools**, not as derivations
 *
 * The ticket is explicit about this and so is the suite: 7 and 310 are the sheet's numbers, but
 * what *produces* them on the sample character needs investment data the export does not carry.
 * These rows therefore pin the pool contract — a stored current value seeded from, and measured
 * against, a derived maximum — and claim nothing about the arithmetic behind the maximum.
 */
export const poolFixtures: readonly PoolFixture[] = [
  { statId: 'stat-health', expectedMax: 7, name: 'Health is a pool with a maximum of 7' },
  { statId: 'stat-mana', expectedMax: 310, name: 'Mana is a pool with a maximum of 310' },
].map((row) => ({
  ...row,
  citation: {
    concept: '20 · Resource & Action',
    section: '`current` and `max` are separate fields',
  },
}));
