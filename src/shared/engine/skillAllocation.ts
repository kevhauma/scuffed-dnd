/**
 * Stat Point Allocation Validator
 *
 * Answers "may this Player spend their points this way?" for a stat investment, as data. Pure:
 * it never throws and never renders — the creation wizard and any later level-up UI both read the
 * result rather than repeating the arithmetic.
 *
 * The rule is a **single global pool**, and since TICKET-RES-02 the pool is **derived**:
 *
 * ```
 * available = level × const.points_per_level + granted
 * remaining = available − Σ invested points
 * ```
 *
 * The `granted` term arrived with TICKET-DM-01 and is the DM's handout
 * ([D9](../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)).
 * It is added to the derived pool rather than replacing it, which is the whole reason
 * `Character.grantedStatPoints` is a grant and not a writable budget: award experience and the
 * level still moves the pool underneath it.
 *
 * matching the sheet's `Charactersheet!E17`. The flat `Configuration.mainSkillPointBudget` and its
 * "absent means unlimited" are gone: there is no longer any way to express an unlimited pool, which
 * is the point — a budget nobody can exceed is not a budget, and every ruleset now prices spending
 * the same way.
 *
 * **The budget can fail**, because the level can (TICKET-RES-01 reads it backwards out of the
 * `xp_thresholds` curve, which is User data). It is a `FormulaResult` for the same reason the level
 * is: a confident budget derived from a level that could not be computed would let a Player spend
 * points the ruleset never granted. An unavailable budget makes the allocation invalid rather than
 * unlimited (Concept 00 §7).
 *
 * **`starting_points` is a spec open question** — Concept 20 does not say whether a fresh character
 * gets a bonus pool on top of their level's. Until the User decides, level 1's budget *is* the
 * starting budget, which is what the sheet's own formula does.
 *
 * Two rules changed with TICKET-STAT-01. Allocations are keyed by **stat id** rather than by a
 * code, so renaming a stat cannot orphan one. And the old per-skill `maxLevel` is gone: an
 * investment cap and a value clamp were never the same thing, and the unified stat has `min`/`max`
 * on the *value*. If a per-stat investment cap is wanted later, it is an additive field.
 *
 * **Validates: Concept 06; Concept 05; Concept 01; Requirements 2.4, 11.3**
 */

import type { Character } from '../types/character';
import type { Configuration, StatAffinity } from '../types/config';
import type { FormulaResult } from '../types/formula';
import { affinityFor, archetypeOf, pointBuyCurve, statGain } from './calculators/pointBuy';
import { calculateCharacterLevel } from './characterSummary';
import { namedConstant } from './formula/constants';
import { isFormulaError } from './formula/errors';

/**
 * Why a single stat's allocation is not allowed
 *
 * `derived-stat` came with TICKET-STAT-01: a stat with a formula computes its own value, so points
 * put into it would be silently discarded by the calculator rather than doing nothing visible.
 *
 * `unpriceable-gain` came with TICKET-ARC-02, and is the same argument one layer along: the seeded
 * `point_buy` table stops at 15 points and refuses out-of-range, so a spend past it has no value
 * the ruleset can name. Letting it through would persist an allocation whose stat then renders as
 * an error chip with nothing having refused it — the state RES-02's "an unpriceable pool is not a
 * licence to spend" exists to prevent, met again per stat rather than per pool.
 */
export type StatAllocationViolationReason = 'negative-points' | 'derived-stat' | 'unpriceable-gain';

/**
 * One stat's allocation being out of bounds, independent of the budget
 */
export interface StatAllocationViolation {
  statId: string;
  statName: string;
  points: number;
  reason: StatAllocationViolationReason;
}

/** The constant a level is multiplied by to reach a budget, and its Concept 05 seed */
const POINTS_PER_LEVEL_NAME = 'points_per_level';
const DEFAULT_POINTS_PER_LEVEL = 3;

/**
 * The ruleset's points-per-level, or Concept 05's seeded 3
 *
 * Read **by name** through `namedConstant`, like `const.bonus_divider` and
 * `const.race_blend_divisor` and with the same consequence: this is system arithmetic rather than
 * a User formula, so there is nothing for `references.ts` to re-spell and renaming the constant
 * falls back to the seed rather than following. Zero is a legitimate ruleset ("levels grant no
 * points"), so only a negative or non-finite value falls back.
 */
function pointsPerLevel(config: Configuration): number {
  return namedConstant(
    config.constants,
    POINTS_PER_LEVEL_NAME,
    DEFAULT_POINTS_PER_LEVEL,
    (value) => value >= 0
  );
}

/**
 * The DM's grant on a character, as a number this can add (TICKET-DM-01)
 *
 * Absent means none, like `purse`. Anything that is not a **whole**, positive number is read as none
 * rather than trusted: `setGrantedPoints` refuses every other shape, so a stored one came from an
 * older build or a hand-edited file. `Number.isInteger` rather than `Number.isFinite`, because the
 * two would otherwise disagree — the field's own docblock says whole, the write route enforces
 * whole, and a stored `2.5` slipping through here would price a budget nothing could have granted.
 * A `NaN` in particular would make the whole budget `NaN`, which is a number as far as
 * `isFormulaError` is concerned — exactly the silently-wrong value Concept 00 §7 forbids.
 */
function grantedFrom(character: Character): number {
  const granted = character.grantedStatPoints;

  return typeof granted === 'number' && Number.isInteger(granted) && granted > 0 ? granted : 0;
}

/**
 * What one stat's spend bought (Concept 03, TICKET-ARC-02)
 *
 * Reported so the wizard and the sheet can render "7 points in Char → +9" from the engine rather
 * than looking the curve up themselves. `gain` is a `FormulaResult` for the same reason the stat's
 * composed value is: the `point_buy` table can refuse an input.
 */
export interface StatAllocationGain {
  statId: string;
  statName: string;
  /** How much the character's archetype favours this stat */
  affinity: StatAffinity;
  /** Points the Player put in */
  points: number;
  /** What those points bought, through the affinity's `point_buy` column */
  gain: FormulaResult;
}

/**
 * The verdict on a whole allocation
 */
export interface StatAllocationResult {
  /** True when the allocation is within budget and every stat is within its own bounds */
  isValid: boolean;
  /** Total points allocated across the configuration's investable stats */
  pointsSpent: number;
  /**
   * What the DM handed out on top of the derived pool (TICKET-DM-01, v3 Req 42.3)
   *
   * Reported separately from {@link pointBudget} so a surface can say *12 (+3 granted)* rather than
   * a 15 nobody can account for — and so the DM's revoke control can price a revocation against the
   * number it is about to change.
   */
  grantedPoints: number;
  /** `level × const.points_per_level + granted`, or the error that stood in for the level */
  pointBudget: FormulaResult;
  /** Budget minus spend, or the same error the budget carries */
  pointsRemaining: FormulaResult;
  /** True only when the budget is a number and the spend exceeds it */
  isOverBudget: boolean;
  /**
   * What each investable stat's spend bought, in configuration order (TICKET-ARC-02)
   *
   * Every investable stat gets a row, including the ones at zero — "you have spent nothing here"
   * is a thing a Player allocating points needs to see, and an absent row would read as a stat
   * that does not exist.
   */
  gains: StatAllocationGain[];
  /** Per-stat problems: negative, or points put into a derived stat */
  violations: StatAllocationViolation[];
  /** Allocated ids that are not stats in this configuration */
  unknownStatIds: string[];
}

/**
 * Validate a stat point allocation against a configuration
 *
 * Takes the whole `Character` rather than its allocation map because the budget is derived from
 * the character's **experience**: the same call has to answer "how many points do they have" and
 * "how many have they spent", and splitting those across two arguments is how the two drift apart.
 * The creation wizard passes the draft it is about to save, whose experience is 0 — so a new
 * character is validated against level-at-XP-0's budget, the same number the sheet will show it a
 * moment later.
 *
 * Points for ids the configuration does not define are reported separately and do not count
 * towards the spend — a stale id should not silently consume a Player's budget.
 *
 * @param character - The character whose invested points and experience are being read
 * @param config - The configuration whose rules apply
 * @returns Points spent and remaining, per-stat violations, and the overall verdict
 */
export function validateStatAllocation(
  character: Character,
  config: Configuration
): StatAllocationResult {
  const investedStatPoints = character.investedStatPoints;
  const violations: StatAllocationViolation[] = [];
  const gains: StatAllocationGain[] = [];
  let pointsSpent = 0;

  // Resolved once for the whole allocation rather than per stat — the archetype and the curve are
  // properties of the character and the ruleset, not of any one row (TICKET-ARC-02)
  const archetype = archetypeOf(character, config);
  const curve = pointBuyCurve(config);

  for (const stat of config.stats) {
    const points = investedStatPoints[stat.id] ?? 0;

    // A derived stat computes its own value, so there is nothing a point could buy in it
    if (stat.formula === undefined) {
      const affinity = affinityFor(archetype, stat.id);
      const gain = statGain(points, affinity, curve);
      gains.push({ statId: stat.id, statName: stat.name, affinity, points, gain });

      // A spend the table cannot price is refused here rather than persisted and chipped later.
      // The points still count towards the spend — they *were* spent, and reporting "10 of 15"
      // while the Player is looking at 16 in a box would be the wrong number to argue with.
      if (isFormulaError(gain)) {
        violations.push({
          statId: stat.id,
          statName: stat.name,
          points,
          reason: 'unpriceable-gain',
        });
      }
    }

    if (points === 0) continue;

    if (stat.formula !== undefined) {
      violations.push({
        statId: stat.id,
        statName: stat.name,
        points,
        reason: 'derived-stat',
      });
      continue;
    }

    if (points < 0) {
      violations.push({
        statId: stat.id,
        statName: stat.name,
        points,
        reason: 'negative-points',
      });
      continue;
    }

    pointsSpent += points;
  }

  const knownIds = new Set(config.stats.map((stat) => stat.id));
  const unknownStatIds = Object.keys(investedStatPoints).filter((id) => !knownIds.has(id));

  // `level × points_per_level + granted`, carrying the level's error forward rather than
  // substituting a number for it — see the module header. A grant does **not** rescue an
  // underivable pool: a ruleset that cannot say how many points exist cannot say this spend is
  // allowed either, and three granted points are three points on top of an unknown number.
  const level = calculateCharacterLevel(character, config);
  const grantedPoints = grantedFrom(character);
  const pointBudget: FormulaResult = isFormulaError(level)
    ? level
    : level * pointsPerLevel(config) + grantedPoints;
  const pointsRemaining: FormulaResult = isFormulaError(pointBudget)
    ? pointBudget
    : pointBudget - pointsSpent;
  const isOverBudget = !isFormulaError(pointsRemaining) && pointsRemaining < 0;

  return {
    // A budget that could not be derived is not a licence to spend: the allocation is unverifiable,
    // so it is reported as invalid and the surfaces chip the level's error
    isValid:
      !isOverBudget &&
      !isFormulaError(pointBudget) &&
      violations.length === 0 &&
      unknownStatIds.length === 0,
    pointsSpent,
    grantedPoints,
    pointBudget,
    pointsRemaining,
    isOverBudget,
    gains,
    violations,
    unknownStatIds,
  };
}
