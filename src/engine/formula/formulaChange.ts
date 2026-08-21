/**
 * Formula Change Guard
 *
 * Validates a single stat or skill formula against the configuration **as it would be after the
 * save**, so an edit that introduces a self-reference, a cycle, or an undefined code is refused
 * rather than persisted.
 *
 * Pure engine code: it reuses `validateFormula` and `validateFormulaCollection` and adds no
 * second cycle detector.
 *
 * **Validates: Requirements 16.5, 16.6, 2.3, 3.5, 18.2**
 */

import type { Configuration } from '../../types/config';
import type { FormulaValidationResult } from '../../types/formula';
import type { FormulaOwner } from './scoping';
import { scopeFor } from './scoping';
import type { FormulaDependency } from './validator';
import {
  dependencyKeysOf,
  toFormulaDependency,
  validateFormula,
  validateFormulaCollection,
} from './validator';

/**
 * A pending formula save
 *
 * `owner` is the attachment point; `scoping.ts` owns that concept and the tables keyed by it.
 */
export interface FormulaChange {
  owner: FormulaOwner;
  /** Stat id or skill code as it will be after the save */
  id: string;
  formula: string;
  /** The id or code being replaced when editing an existing entry; omit when adding */
  previousId?: string;
}

/**
 * Build the formula dependency graph the configuration would have after the change
 *
 * **A derived stat is the only node kind left.** Combat skills were the other one and went with the
 * entity in TICKET-ROLL-06; a `Skill` has never been one since TICKET-SKL-02 (weight rows, not a
 * formula), and a `RollDefinition` cannot be one because nothing can reference a roll. So the graph
 * is stats, keyed by id — the same keys `engine/validator.ts` uses, so both paths agree about what
 * a cycle is — plus the edited formula substituted in, which is what catches a stat that would name
 * itself.
 */
function dependenciesAfterChange(
  config: Configuration,
  change: FormulaChange,
  dependencyKeys: string[]
): FormulaDependency[] {
  const replacedId = change.previousId ?? change.id;

  const dependencies: FormulaDependency[] = [
    // An invested stat has no formula, so it is no edge in the dependency graph (TICKET-STAT-01)
    ...config.stats
      .filter((stat) => stat.formula !== undefined)
      .filter((stat) => !(change.owner === 'stat' && stat.id === replacedId))
      .map((stat) => toFormulaDependency(stat.id, stat.formula as string)),
  ];

  // The edited formula, substituted in
  dependencies.push({
    id: change.id,
    formula: change.formula,
    referencedVariables: dependencyKeys,
  });

  return dependencies;
}

/**
 * Validate a pending formula save
 *
 * Runs three checks in order, stopping at the first that fails:
 * 1. syntax, via the parser;
 * 2. circular dependencies across the whole post-save formula set — including a formula that
 *    names its own entity, which the detector reports as the one-step cycle `X → X`. Dotted
 *    references are edges too (TICKET-FORM-04), so a cycle written `stats.health` is caught the
 *    same as one written `HEALTH`;
 * 3. scope — undefined codes, unknown or out-of-context namespaces, and unknown members, all
 *    from the `scopeFor` table rather than a branch per owner kind.
 *
 * Cycles are checked **before** scope on purpose. A code that closes a cycle is usually also out
 * of scope for the formula that names it (a speciality formula may reference main skills only),
 * and "Circular dependency detected: ACR → STL → ACR" tells the User far more than "Undefined
 * variable: STL". Either way the save is refused.
 *
 * @param config - The configuration as it is now
 * @param change - The formula about to be saved
 * @returns A validation result whose `errors` are safe to show the user verbatim
 */
export function validateFormulaChange(
  config: Configuration,
  change: FormulaChange
): FormulaValidationResult {
  // Parse first — an unparseable formula has no references to reason about
  const parsed = validateFormula(change.formula);
  if (!parsed.isValid) {
    return parsed;
  }

  // Circular dependencies across the configuration as it would be after the save (Req 16.5)
  const collection = validateFormulaCollection(
    dependenciesAfterChange(config, change, dependencyKeysOf(parsed))
  );
  if (!collection.isValid) {
    return {
      isValid: false,
      errors: collection.errors,
      referencedVariables: parsed.referencedVariables,
      namespacedReferences: parsed.namespacedReferences,
    };
  }

  // Scope: undefined codes (Requirement 16.6) plus namespace/member scoping (Concept 00 §5)
  const scope = scopeFor(config, change.owner);
  const scoped = validateFormula(change.formula, scope.codes, scope);
  if (!scoped.isValid) {
    return scoped;
  }

  return {
    isValid: true,
    errors: [],
    referencedVariables: parsed.referencedVariables,
    namespacedReferences: parsed.namespacedReferences,
  };
}
