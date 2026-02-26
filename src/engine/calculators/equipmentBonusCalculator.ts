/**
 * Equipment Bonus Calculator
 * 
 * Aggregates bonuses from all equipped items including material bonuses.
 */

import type { Character } from '../../types/character';
import type { Configuration, SkillModifier } from '../../types/config';

/**
 * Calculate equipment bonuses from all equipped items
 * 
 * Collects bonuses from all equipped items and combines them additively.
 * If an item has a material, the material's bonuses are applied.
 * 
 * @param character - The character whose equipment to evaluate
 * @param config - The game configuration containing items and materials
 * @returns Array of skill modifiers from all equipped items
 */
export function calculateEquipmentBonuses(
  character: Character,
  config: Configuration
): SkillModifier[] {
  const bonusMap: Record<string, number> = {};

  // Iterate through all equipped items
  for (const itemId of Object.values(character.inventory.equippedItems)) {
    // Find the item in configuration
    const item = config.items.find((i) => i.id === itemId);
    if (!item) continue;

    // If item has a material, get material bonuses
    if (item.materialId && item.materialLevel !== undefined) {
      const material = config.materials.find((m) => m.id === item.materialId);
      if (!material) continue;

      // Find the specific material level
      const materialLevel = material.levels.find((l) => l.level === item.materialLevel);
      if (!materialLevel) continue;

      // Add all bonuses from this material level
      for (const bonus of materialLevel.bonuses) {
        const currentBonus = bonusMap[bonus.skillCode] || 0;
        bonusMap[bonus.skillCode] = currentBonus + bonus.modifier;
      }
    }
  }

  // Convert bonus map to array of SkillModifiers
  return Object.entries(bonusMap).map(([skillCode, modifier]) => ({
    skillCode,
    modifier,
  }));
}
