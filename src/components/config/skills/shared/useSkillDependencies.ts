/**
 * Shared hook for checking skill dependencies
 * 
 * Used by all skill types to check if a skill is referenced elsewhere.
 */

import { useConfigStore } from '../../../../stores/configStore';

export function useSkillDependencies() {
  const config = useConfigStore((state) => state.config);

  const checkDependencies = (code: string): string[] => {
    if (!config) return [];
    
    const dependencies: string[] = [];
    
    // Check stats
    config.stats.forEach(stat => {
      if (stat.formula.includes(code)) {
        dependencies.push(`Stat: ${stat.name}`);
      }
    });
    
    // Check speciality skills
    config.specialitySkills.forEach(skill => {
      if (skill.bonusFormula.includes(code)) {
        dependencies.push(`Speciality Skill: ${skill.name}`);
      }
    });
    
    // Check combat skills
    config.combatSkills.forEach(skill => {
      if (skill.bonusFormula.includes(code)) {
        dependencies.push(`Combat Skill: ${skill.name}`);
      }
    });
    
    return dependencies;
  };

  return { checkDependencies };
}
