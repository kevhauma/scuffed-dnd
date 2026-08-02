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
import type { FormulaDependency } from './validator';
import { validateFormula, validateFormulaCollection } from './validator';

/**
 * Which collection the changed formula belongs to
 */
export type FormulaOwner = 'stat' | 'speciality-skill' | 'combat-skill';

/**
 * A pending formula save
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
 * Codes a formula of this kind is allowed to reference
 *
 * Mirrors Requirements 2.2 (stats reference main skills), 3.3 (speciality skills reference main
 * skills) and 4.4 (combat skills reference main and speciality skills).
 */
function availableCodesFor(config: Configuration, owner: FormulaOwner): Set<string> {
  const mainCodes = config.mainSkills.map((skill) => skill.code);

  if (owner === 'combat-skill') {
    return new Set([...mainCodes, ...config.specialitySkills.map((skill) => skill.code)]);
  }

  return new Set(mainCodes);
}

/**
 * Build the formula dependency graph the configuration would have after the change
 *
 * Stats are keyed by id, skills by code — the same keys `engine/validator.ts` uses, so both
 * paths agree about what a cycle is.
 */
function dependenciesAfterChange(
  config: Configuration,
  change: FormulaChange,
  referencedVariables: string[]
): FormulaDependency[] {
  const replacedId = change.previousId ?? change.id;

  const toDependency = (id: string, formula: string): FormulaDependency => ({
    id,
    formula,
    referencedVariables: validateFormula(formula).referencedVariables,
  });

  const dependencies: FormulaDependency[] = [
    ...config.stats
      .filter((stat) => !(change.owner === 'stat' && stat.id === replacedId))
      .map((stat) => toDependency(stat.id, stat.formula)),
    ...config.specialitySkills
      .filter((skill) => !(change.owner === 'speciality-skill' && skill.code === replacedId))
      .map((skill) => toDependency(skill.code, skill.bonusFormula)),
    ...config.combatSkills
      .filter((skill) => !(change.owner === 'combat-skill' && skill.code === replacedId))
      .map((skill) => toDependency(skill.code, skill.bonusFormula)),
  ];

  // The edited formula, substituted in
  dependencies.push({ id: change.id, formula: change.formula, referencedVariables });

  return dependencies;
}

/**
 * Validate a pending formula save
 *
 * Runs three checks in order, stopping at the first that fails:
 * 1. syntax, via the parser;
 * 2. circular dependencies across the whole post-save formula set — including a formula that
 *    names its own entity, which the detector reports as the one-step cycle `X → X`;
 * 3. undefined codes.
 *
 * Cycles are checked **before** undefined codes on purpose. A code that closes a cycle is
 * usually also out of scope for the formula that names it (a speciality formula may reference
 * main skills only), and "Circular dependency detected: ACR → STL → ACR" tells the User far more
 * than "Undefined variable: STL". Either way the save is refused.
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
    dependenciesAfterChange(config, change, parsed.referencedVariables)
  );
  if (!collection.isValid) {
    return {
      isValid: false,
      errors: collection.errors,
      referencedVariables: parsed.referencedVariables,
    };
  }

  // Undefined codes (Requirement 16.6)
  const withCodes = validateFormula(change.formula, availableCodesFor(config, change.owner));
  if (!withCodes.isValid) {
    return withCodes;
  }

  return {
    isValid: true,
    errors: [],
    referencedVariables: parsed.referencedVariables,
  };
}
