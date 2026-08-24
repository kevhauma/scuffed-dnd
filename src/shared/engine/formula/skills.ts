/**
 * Skills Namespace
 *
 * What backs `skills.<name>` in a formula (Concept 02) — a skill's **level**, and its **bonus**
 * through the `.bonus` property: `skills.stealth` is 11.7, `skills.stealth.bonus` is 2. Both are
 * offered because both are real numbers a ruleset reaches for, and which one a formula wants is
 * the formula's business: a roll adds the bonus, a threshold compares the level. The level can be
 * named either way — `skills.stealth` and `skills.stealth.level` are the same reading (CR-10).
 *
 * Resolution is by the skill's **name slug**, the same derivation `stats.*` uses and for the same
 * reason: a `Skill` has no code since TICKET-SKL-02, and the persisted formula holds the skill's
 * id, so renaming re-spells every formula naming it without changing what they point at.
 *
 * A skill that exists but has **no value yet** is distinguishable from one that does not exist —
 * the first is a `not-evaluable` error, the second is `undefined`, which the evaluator reports as
 * `Unknown member`. Skills are computed in one pass today (their levels read stats, never other
 * skills), so the first case only arises from a caller that supplied no values at all.
 *
 * **Validates: Concept 02; Concept 00 §5, §7; spec §5.1**
 */

import type { Skill } from '../../types/config';
import type { FormulaResult, NamespaceResolver } from '../../types/formula';
import { formulaError } from './errors';
import { skillMemberName } from './references';

/** The property that reads a skill's bonus rather than its level */
const BONUS_PROPERTY = 'bonus';

/**
 * The property that names a skill's level explicitly (CR-10)
 *
 * `skills.stealth` and `skills.stealth.level` are the same number. The bare form is the older
 * spelling and stays exactly as it was; the explicit one exists because the grammar docs, the
 * references module and `rollCalculator`'s header all present `.level` as part of the surface —
 * four documentation sites against one resolver that answered `unknown-member`, with a message
 * that said "a skill has a level" while refusing to give it. A formula written from the engine's
 * own documentation validated, saved, and then failed on the sheet, so the resolver is what moved.
 */
const LEVEL_PROPERTY = 'level';

/**
 * Build the `skills` resolver over already-computed levels and bonuses
 *
 * @param skills - The configuration's skills, for the spelling → id mapping
 * @param levels - Computed levels, keyed by skill id; a missing entry is "not yet"
 * @param bonuses - Computed bonuses, keyed by skill id
 * @returns A resolver for `FormulaContext.namespaces.skills`
 */
export function skillsNamespace(
  skills: Skill[],
  levels: Record<string, FormulaResult>,
  bonuses: Record<string, FormulaResult>
): NamespaceResolver {
  // First spelling wins, matching `references.ts`'s index — two skills slugging the same way
  // should not exist, but the sheet has `skinning` and `Skinning` (Concept 02's import note), so
  // both halves must at least agree which one answers.
  const byMember = new Map<string, Skill>();
  for (const skill of skills) {
    const member = skillMemberName(skill);
    if (!byMember.has(member)) byMember.set(member, skill);
  }

  return {
    resolve(member, property) {
      const skill = byMember.get(member);
      if (!skill) return undefined;

      if (property !== undefined && property !== BONUS_PROPERTY && property !== LEVEL_PROPERTY) {
        return formulaError(
          'unknown-member',
          `skills.${member} has no property ${property} — a skill has a ${LEVEL_PROPERTY} and a ${BONUS_PROPERTY}`
        );
      }

      const value = (property === BONUS_PROPERTY ? bonuses : levels)[skill.id];
      if (value === undefined) {
        return formulaError(
          'not-evaluable',
          `skills.${member} is not available here — no skill values were supplied`
        );
      }

      return value;
    },
  };
}
