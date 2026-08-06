/**
 * Constants Namespace
 *
 * What backs `const.<name>` in a formula (Concept 05). A constant is the ruleset's tunable number
 * — `bonus_divider`, `apt_value` — named once and edited once, instead of the same literal being
 * buried in dozens of formula strings.
 *
 * Resolution is by **name**, because that is the form an in-memory formula is written in; the
 * persisted formula holds the constant's id, and `references.ts` translates between them, so
 * renaming `bonus_divider` re-spells every formula naming it without changing what they point at
 * (TICKET-REF-01).
 *
 * A constant's value is a plain number today. The spec allows it to be a formula over other
 * constants; that extension goes here, and it will need the cycle detection `validator.ts`
 * already has rather than a second one.
 *
 * **Validates: Concept 05; spec §5.1**
 */

import type { Constant } from '../../types/config';
import type { NamespaceResolver } from '../../types/formula';
import { formulaError } from './errors';

/**
 * Build the `const` resolver for a configuration's constants
 *
 * An unknown member resolves to `undefined`, which the evaluator turns into a distinct
 * `Unknown member: const.x` rather than a silent zero (Concept 00 §7). A property access on a
 * constant (`const.x.y`) is a mistake rather than a feature, so it is reported as one.
 *
 * @param constants - The configuration's constants; absent is the same as none
 * @returns A resolver for `FormulaContext.namespaces.const`
 */
export function constantsNamespace(constants: Constant[] = []): NamespaceResolver {
  // First spelling wins, matching `references.ts`'s reference index. Duplicate names should not
  // exist, but if one arrives by import the two must at least agree about which constant a
  // formula points at and which value it reads.
  const byName = new Map<string, Constant>();
  for (const constant of constants) {
    if (!byName.has(constant.name)) byName.set(constant.name, constant);
  }

  return {
    resolve(member, property) {
      const constant = byName.get(member);
      if (!constant) return undefined;

      if (property !== undefined) {
        return formulaError(
          'unknown-member',
          `const.${member} has no property ${property} — a constant is a single number`
        );
      }

      return constant.value;
    },
  };
}
