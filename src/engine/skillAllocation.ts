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
 * available = level × const.points_per_level
 * remaining = available − Σ invested points
 * ```
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
import type { Configuration } from '../types/config';
import type { FormulaResult } from '../types/formula';
import { calculateCharacterLevel } from './characterSummary';
import { isFormulaError } from './formula/errors';

/**
 * Why a single stat's allocation is not allowed
 *
 * `derived-stat` is the new one: a stat with a formula computes its own value, so points put into
 * it would be silently discarded by the calculator rather than doing nothing visible.
 */
export type StatAllocationViolationReason = 'negative-points' | 'derived-stat';

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
 * Read **by name**, like `const.bonus_divider` and `const.race_blend_divisor` and with the same
 * consequence: this is system arithmetic rather than a User formula, so there is nothing for
 * `references.ts` to re-spell and renaming the constant falls back to the seed rather than
 * following. Zero is a legitimate ruleset ("levels grant no points"), so only a negative or
 * non-finite value falls back.
 */
function pointsPerLevel(config: Configuration): number {
  const value = (config.constants ?? []).find(
    (constant) => constant.name === POINTS_PER_LEVEL_NAME
  )?.value;

  return value !== undefined && Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_POINTS_PER_LEVEL;
}

/**
 * The verdict on a whole allocation
 */
export interface StatAllocationResult {
  /** True when the allocation is within budget and every stat is within its own bounds */
  isValid: boolean;
  /** Total points allocated across the configuration's investable stats */
  pointsSpent: number;
  /** `level × const.points_per_level`, or the error that stood in for the level */
  pointBudget: FormulaResult;
  /** Budget minus spend, or the same error the budget carries */
  pointsRemaining: FormulaResult;
  /** True only when the budget is a number and the spend exceeds it */
  isOverBudget: boolean;
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
  let pointsSpent = 0;

  for (const stat of config.stats) {
    const points = investedStatPoints[stat.id] ?? 0;

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

  // `level × points_per_level`, carrying the level's error forward rather than substituting a
  // number for it — see the module header
  const level = calculateCharacterLevel(character, config);
  const pointBudget: FormulaResult = isFormulaError(level) ? level : level * pointsPerLevel(config);
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
    pointBudget,
    pointsRemaining,
    isOverBudget,
    violations,
    unknownStatIds,
  };
}
