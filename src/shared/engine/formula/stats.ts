/**
 * Stats Namespace
 *
 * What backs `stats.<name>` in a formula (Concept 01) — the composed value of another stat, which
 * is how a derived stat like APT reads the Speed it depends on:
 * `max(1, round(stats.speed / const.apt_value))`.
 *
 * Resolution is by the stat's **name slug**, not by its abbreviation. The abbreviation serves the
 * flat space (`STR + DEX`), and keeping the two apart means a ruleset can rename either without
 * the other's spellings moving. `references.ts` stores the stat's id in the persisted form, so
 * both spellings are display data.
 *
 * A stat that exists but has **no value yet** is the load-bearing case: derived stats are resolved
 * in passes, and "not computed yet" has to be distinguishable from "not a stat". The first is a
 * `not-evaluable` error the composition retries after the next pass; the second is `undefined`,
 * which the evaluator reports as `Unknown member`.
 *
 * **Validates: Concept 01; Concept 00 §5, §7; spec §5.1**
 */

import type { Stat } from '../../types/config';
import type { FormulaResult, NamespaceResolver } from '../../types/formula';
import { formulaError } from './errors';
import { statMemberName } from './references';

/**
 * Build the `stats` resolver over a set of already-composed values
 *
 * @param stats - The configuration's stats, for the spelling → id mapping
 * @param values - Composed values so far, keyed by stat id; a missing entry is "not yet"
 * @returns A resolver for `FormulaContext.namespaces.stats`
 */
export function statsNamespace(
  stats: Stat[],
  values: Record<string, FormulaResult>
): NamespaceResolver {
  // First spelling wins, matching `references.ts`'s index — two stats slugging the same way
  // should not exist, but if one arrives by import both halves must agree which one answers
  const byMember = new Map<string, Stat>();
  for (const stat of stats) {
    const member = statMemberName(stat);
    if (!byMember.has(member)) byMember.set(member, stat);
  }

  return {
    resolve(member, property) {
      const stat = byMember.get(member);
      if (!stat) return undefined;

      if (property !== undefined) {
        return formulaError(
          'unknown-member',
          `stats.${member} has no property ${property} — a stat is a single value`
        );
      }

      const value = values[stat.id];
      if (value === undefined) {
        // Either this pass has not reached it yet, or it is in a cycle. The composition decides
        // which by whether another pass changes anything; the validator reports cycles properly.
        return formulaError(
          'not-evaluable',
          `stats.${member} is not available yet — it may depend on this stat in turn`
        );
      }

      return value;
    },
  };
}
