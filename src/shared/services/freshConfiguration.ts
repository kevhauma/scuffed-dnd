/**
 * What a brand-new ruleset arrives holding (TICKET-RUL-01)
 *
 * **Moved here from `client/stores/configStore.ts` rather than copied**, and that is the whole
 * point of the module. v3 Req 33.3 asks that a Ruleset the *server* creates be seeded "exactly as
 * `createFreshConfiguration()` seeds one, so a server-created ruleset and a browser-created one are
 * the same ruleset" — and the only construction that cannot drift is the one where there is nothing
 * to drift from. A second seeder in `src/server/` would agree on the day it was written and disagree
 * the first time somebody retunes a constant.
 *
 * It belongs in the Kernel by
 * [D5](../../../docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)'s
 * test: a rule both sides need lives in `shared/`. Nothing here touches React, storage or the
 * network — it builds a `Configuration` and hands it back. `crypto.randomUUID()` and `Date` are the
 * two globals it reads, both present in the browser and in Node, and `importExport.ts` next door
 * already depends on the first.
 *
 * **Validates: Requirements 1.1; v3 Req 33.3; Concept 05 §1, Concept 06 §2, Concepts 07-08**
 */

import { regenerateCurve as regenerateCurveTable } from '../engine/curveGenerator';
import type {
  Configuration,
  Constant,
  Curve,
  DiceLadder,
  RollCategory,
  RollDefinition,
} from '../types/config';
import { POINT_BUY_CURVE_NAME, SUPPORTED_SCHEMA_VERSION } from '../types/config';

/**
 * The constants a fresh ruleset starts with (Concept 05's seed table)
 *
 * Seeded rather than left empty because these are the levers the source sheet actually turns, and
 * a constant is data, not behaviour: `points_per_level` is here before anything reads it
 * (TICKET-RES-02 does), which is the point — the User can retune the ruleset before the feature
 * that consumes the number exists.
 */
function createSeedConstants(): Constant[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'bonus_divider',
      displayName: 'Bonus divider',
      description:
        'How many skill levels are worth one point of bonus. Lower makes skills matter more.',
      value: 5,
    },
    {
      id: crypto.randomUUID(),
      name: 'apt_value',
      displayName: 'APT value',
      description:
        'Speed needed per attack per turn. Lower gives everyone more attacks at the same Speed.',
      value: 30,
    },
    {
      id: crypto.randomUUID(),
      name: 'points_per_level',
      displayName: 'Points per level',
      description: 'Skill points a character receives for each level gained.',
      value: 3,
      unit: 'points',
    },
    {
      id: crypto.randomUUID(),
      name: 'race_blend_divisor',
      displayName: 'Race blend divisor',
      description: 'What a blended base is divided by when a character has more than one race.',
      value: 2,
    },
  ];
}

/**
 * The `non` and `sub` point-buy columns, as the source sheet actually holds them
 *
 * Hand-authored, not generated: Concept 06 measured them as "near-linear with rounding" and no
 * clean formula was confirmed, so inventing one here would replace the User's ruleset with our
 * guess at it. The `4.642857142857` at 9 points comes across too. It is almost certainly an
 * accident — every neighbour is an integer — but the concept page is explicit that it needs a
 * decision rather than a silent rounding, and a number nobody can see cannot be decided about.
 */
const POINT_BUY_HAND_ROWS: readonly (readonly [key: number, non: number, sub: number])[] = [
  [0, 0, 0],
  [1, 1, 1],
  [2, 1, 1],
  [3, 1, 2],
  [4, 2, 2],
  [5, 2, 3],
  [6, 2, 3],
  [7, 3, 4],
  [8, 3, 4],
  [9, 3, 4.642857142857],
  [10, 4, 5],
  [11, 4, 5],
  [12, 4, 6],
  [13, 4, 6],
  [14, 5, 7],
  [15, 5, 7],
];

/**
 * The curves a fresh ruleset starts with (Concept 06's seed tables)
 *
 * Two, for the same reason the constants are seeded: they are the tables the rest of the
 * milestone reads, and a table is easier to retune than to author.
 *
 * **`point_buy`** is the confirmed one. Its `main` column is `0.75 × (points + 1)` exactly, so it
 * ships as a **generator** rather than as sixteen literals — which is what makes Concept 06's
 * "flatten the archetype advantage" a one-field edit. The cells it ships with come from running
 * that generator through the formula engine, not from arithmetic written a second time here: one
 * progression, one source of truth, and retuning the string cannot leave the shipped table
 * disagreeing with it.
 *
 * **`xp_thresholds`** is the shape only. Its numbers are Concept 06's open question #8 — the
 * single most campaign-defining lever in the ruleset — so it arrives with one row (level 1 costs
 * nothing) and waits for the User, rather than pretending a made-up progression is a default.
 */
function createSeedCurves(): Curve[] {
  const pointBuy: Curve = {
    id: crypto.randomUUID(),
    name: POINT_BUY_CURVE_NAME,
    displayName: 'Point buy',
    description:
      'What a point spent on a stat is worth, by how much the archetype favours that stat.',
    keyName: 'points',
    columns: [
      { id: crypto.randomUUID(), name: 'non' },
      { id: crypto.randomUUID(), name: 'sub' },
      { id: crypto.randomUUID(), name: 'main', generator: '0.75 * (key + 1)' },
    ],
    // The generated column starts empty and is filled by its own generator, below
    rows: POINT_BUY_HAND_ROWS.map(([key, non, sub]) => ({ key, values: [non, sub, 0] })),
    interpolation: 'step',
    outOfRange: 'error',
    lookupDirection: 'forward',
  };

  return [
    regenerateCurveTable(pointBuy).curve,
    {
      id: crypto.randomUUID(),
      name: 'xp_thresholds',
      displayName: 'XP thresholds',
      description:
        'Total experience needed for each level. Read backwards: given the XP, which level. ' +
        'Placeholder — set your own thresholds before anyone levels.',
      keyName: 'level',
      columns: [{ id: crypto.randomUUID(), name: 'xp_required' }],
      rows: [{ key: 1, values: [0] }],
      interpolation: 'step',
      outOfRange: 'extrapolate',
      lookupDirection: 'reverse',
    },
  ];
}

/**
 * The dice ladder and rolls a fresh ruleset starts with (Concepts 07 and 08)
 *
 * The **ladder** is the best-confirmed thing in the source sheet — `[20, 12, 6]`, read from the
 * Calculator's own literal row and confirmed again by six decompositions — so it is seeded flatly.
 *
 * The **rolls** are the sheet's four names, each with a **placeholder input of `0`** and a
 * description saying what the sheet reads there. The to-be asked for `stats.str` and friends, and
 * that is not seedable: a fresh ruleset has no stats, so those four expressions would name members
 * that do not exist and a brand-new configuration would open reporting four errors. `0` always
 * computes, so the seed states the ruleset's *shape* — four named rolls down one ladder — without
 * claiming an expression the User has not written yet.
 *
 * The descriptions carry what the export actually proves: melee and ranged are the raw stat;
 * evasion and endure carry an extra term the sheet does not explain, which is Concept 08's open
 * question and is named as unknown rather than invented.
 *
 * Returned as a pair because the rolls point at the ladder by id, so the two cannot be minted
 * independently without one re-deriving the other's identity.
 */
function createSeedRolls(): { ladders: DiceLadder[]; rolls: RollDefinition[] } {
  const ladder: DiceLadder = {
    id: crypto.randomUUID(),
    name: 'Standard',
    description:
      "The sheet's ladder: a value becomes D20s, then D12s, then D6s, with the leftover as a flat bonus.",
    dieSizes: [20, 12, 6],
    showZeroTerms: true,
    remainder: 'flat',
  };

  // The second sentence states what the *source sheet* reads, which stays true whatever the User
  // writes; only the "Placeholder input" label goes stale, and it has to be there — four rolls that
  // silently produce 0 with nothing saying why is worse than a label somebody edits away.
  const seeds: Array<[name: string, category: RollCategory, reads: string]> = [
    ['Melee', 'offence', 'The source sheet reads the raw Strength stat.'],
    ['Ranged', 'offence', 'The source sheet reads the raw Dexterity stat.'],
    [
      'Evasion',
      'defence',
      'The source sheet reads Dexterity plus a term its export does not explain.',
    ],
    [
      'Endure',
      'defence',
      'The source sheet reads Constitution plus a term its export does not explain.',
    ],
  ];

  return {
    ladders: [ladder],
    rolls: seeds.map(([name, category, reads], index) => ({
      id: crypto.randomUUID(),
      name,
      description: `Placeholder input. ${reads}`,
      input: '0',
      ladderId: ladder.id,
      category,
      order: index,
    })),
  };
}

/**
 * Create a fresh configuration
 *
 * Not "empty": a new ruleset arrives with Concept 05's seed constants, Concept 06's seed curves and
 * Concept 07/08's ladder and four rolls already in it.
 *
 * **Every call produces fresh ids and fresh timestamps**, which is what makes it safe for two
 * callers — `useConfigStore.initializeConfig` and `POST /api/rulesets` — to share one function.
 * A test comparing two of its results has to exclude those, and `freshConfiguration.test.ts` says
 * how.
 *
 * @param name What the User called it
 * @returns A complete, seeded `Configuration`
 */
export function createFreshConfiguration(name: string): Configuration {
  const now = new Date().toISOString();
  const { ladders, rolls } = createSeedRolls();
  return {
    id: crypto.randomUUID(),
    name,
    version: '1.0.0',
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    stats: [],
    skills: [],
    materials: [],
    materialCategories: [],
    items: [],
    equipmentSlots: [],
    races: [],
    currencyTiers: [],
    constants: createSeedConstants(),
    curves: createSeedCurves(),
    diceLadders: ladders,
    rollDefinitions: rolls,
    createdAt: now,
    updatedAt: now,
  };
}
