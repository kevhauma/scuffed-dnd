/**
 * Stat Point Allocation Validator
 *
 * Answers "may this Player spend their points this way?" for a stat investment, as data. Pure:
 * it never throws and never renders — the creation wizard and any later level-up UI both read the
 * result rather than repeating the arithmetic.
 *
 * The rule is a **single global pool**: one point per level, spent across every invested stat.
 * See the ticket for why weighted per-stat costs were not chosen. TICKET-RES-02 replaces the flat
 * pool with `level × const.points_per_level`.
 *
 * Two rules changed with TICKET-STAT-01. Allocations are keyed by **stat id** rather than by a
 * code, so renaming a stat cannot orphan one. And the old per-skill `maxLevel` is gone: an
 * investment cap and a value clamp were never the same thing, and the unified stat has `min`/`max`
 * on the *value*. If a per-stat investment cap is wanted later, it is an additive field.
 *
 * **Validates: Concept 01; Requirements 2.4, 11.3**
 */

import type { Configuration } from '../types/config';

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

/**
 * The verdict on a whole allocation
 */
export interface StatAllocationResult {
  /** True when the allocation is within budget and every stat is within its own bounds */
  isValid: boolean;
  /** Total points allocated across the configuration's investable stats */
  pointsSpent: number;
  /** The configured budget, or `null` when the ruleset does not limit spending */
  pointBudget: number | null;
  /** Budget minus spend, or `null` when unlimited */
  pointsRemaining: number | null;
  /** True only when a budget exists and the spend exceeds it */
  isOverBudget: boolean;
  /** Per-stat problems: negative, or points put into a derived stat */
  violations: StatAllocationViolation[];
  /** Allocated ids that are not stats in this configuration */
  unknownStatIds: string[];
}

/**
 * Validate a stat point allocation against a configuration
 *
 * Points for ids the configuration does not define are reported separately and do not count
 * towards the spend — a stale id should not silently consume a Player's budget.
 *
 * @param investedStatPoints - Allocated points, keyed by stat id
 * @param config - The configuration whose rules apply
 * @returns Points spent and remaining, per-stat violations, and the overall verdict
 */
export function validateStatAllocation(
  investedStatPoints: Record<string, number>,
  config: Configuration
): StatAllocationResult {
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

  // An absent budget means unlimited, so older rulesets stay valid
  const pointBudget = config.mainSkillPointBudget ?? null;
  const pointsRemaining = pointBudget === null ? null : pointBudget - pointsSpent;
  const isOverBudget = pointsRemaining !== null && pointsRemaining < 0;

  return {
    isValid: !isOverBudget && violations.length === 0 && unknownStatIds.length === 0,
    pointsSpent,
    pointBudget,
    pointsRemaining,
    isOverBudget,
    violations,
    unknownStatIds,
  };
}
