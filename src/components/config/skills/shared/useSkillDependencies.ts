/**
 * Shared hook for checking skill dependencies
 *
 * Used by all skill types to check if a skill is referenced elsewhere before it is deleted.
 * References come from the parser, not from substring matching, so a code only counts when a
 * formula genuinely refers to it.
 *
 * **Validates: Requirements 2.5, 2.6**
 */

import { validateFormula } from '../../../../engine/formula/validator';
import { useConfigStore } from '../../../../stores/configStore';

export function useSkillDependencies() {
  const config = useConfigStore((state) => state.config);

  const checkDependencies = (code: string): string[] => {
    if (!config) return [];

    const references = (formula: string): boolean =>
      validateFormula(formula).referencedVariables.includes(code);

    const dependencies: string[] = [];

    // Check stats
    config.stats.forEach((stat) => {
      if (references(stat.formula)) {
        dependencies.push(`Stat: ${stat.name}`);
      }
    });

    // Check speciality skills
    config.specialitySkills.forEach((skill) => {
      if (references(skill.bonusFormula)) {
        dependencies.push(`Speciality Skill: ${skill.name}`);
      }
    });

    // Check combat skills
    config.combatSkills.forEach((skill) => {
      if (references(skill.bonusFormula)) {
        dependencies.push(`Combat Skill: ${skill.name}`);
      }
    });

    return dependencies;
  };

  return { checkDependencies };
}
