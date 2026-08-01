/**
 * Main Skill Allocation Validator
 *
 * Answers "may this Player spend their points this way?" for a main-skill allocation, as data.
 * Pure: it never throws and never renders — the creation wizard and any later level-up UI both
 * read the result rather than repeating the arithmetic.
 *
 * The rule is a **single global pool**: one point per level, spent across every main skill, with
 * each skill still bounded by its own `maxLevel`. See the ticket for why weighted per-skill costs
 * were not chosen.
 *
 * **Validates: Requirements 2.4, 11.3**
 */

import type { Configuration } from '../types/config';

/**
 * Why a single skill's allocation is not allowed
 */
export type MainSkillAllocationViolationReason = 'above-max-level' | 'negative-level';

/**
 * One skill's allocation being out of bounds, independent of the budget
 */
export interface MainSkillAllocationViolation {
  skillCode: string;
  skillName: string;
  level: number;
  maxLevel: number;
  reason: MainSkillAllocationViolationReason;
}

/**
 * The verdict on a whole allocation
 */
export interface MainSkillAllocationResult {
  /** True when the allocation is within budget and every skill is within its own bounds */
  isValid: boolean;
  /** Total levels allocated across the configuration's main skills */
  pointsSpent: number;
  /** The configured budget, or `null` when the ruleset does not limit spending */
  pointBudget: number | null;
  /** Budget minus spend, or `null` when unlimited */
  pointsRemaining: number | null;
  /** True only when a budget exists and the spend exceeds it */
  isOverBudget: boolean;
  /** Per-skill problems: above `maxLevel`, or negative */
  violations: MainSkillAllocationViolation[];
  /** Allocated codes that are not main skills in this configuration */
  unknownSkillCodes: string[];
}

/**
 * Validate a main-skill point allocation against a configuration
 *
 * Levels for codes the configuration does not define are reported separately and do not count
 * towards the spend — a stale code should not silently consume a Player's budget.
 *
 * @param levels - Allocated levels, keyed by main skill code
 * @param config - The configuration whose rules apply
 * @returns Points spent and remaining, per-skill violations, and the overall verdict
 */
export function validateMainSkillAllocation(
  levels: Record<string, number>,
  config: Configuration
): MainSkillAllocationResult {
  const violations: MainSkillAllocationViolation[] = [];
  let pointsSpent = 0;

  for (const skill of config.mainSkills) {
    const level = levels[skill.code] ?? 0;

    if (level < 0) {
      violations.push({
        skillCode: skill.code,
        skillName: skill.name,
        level,
        maxLevel: skill.maxLevel,
        reason: 'negative-level',
      });
      continue;
    }

    if (level > skill.maxLevel) {
      violations.push({
        skillCode: skill.code,
        skillName: skill.name,
        level,
        maxLevel: skill.maxLevel,
        reason: 'above-max-level',
      });
    }

    pointsSpent += level;
  }

  const knownCodes = new Set(config.mainSkills.map((skill) => skill.code));
  const unknownSkillCodes = Object.keys(levels).filter((code) => !knownCodes.has(code));

  // An absent budget means unlimited, so older rulesets stay valid
  const pointBudget = config.mainSkillPointBudget ?? null;
  const pointsRemaining = pointBudget === null ? null : pointBudget - pointsSpent;
  const isOverBudget = pointsRemaining !== null && pointsRemaining < 0;

  return {
    isValid: !isOverBudget && violations.length === 0 && unknownSkillCodes.length === 0,
    pointsSpent,
    pointBudget,
    pointsRemaining,
    isOverBudget,
    violations,
    unknownSkillCodes,
  };
}
