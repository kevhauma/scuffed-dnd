/**
 * Equipment Bonus Calculator
 *
 * Aggregates bonuses from all equipped items including material bonuses.
 *
 * **Validates: Requirements 13.1, 13.2, 13.4**
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

/**
 * Index skill modifiers by skill code
 *
 * The character sheet has to show each skill's equipment contribution separately from its base
 * (Requirement 13.4), which means a per-code lookup rather than a list. Doing it here keeps the
 * summing in the engine — `calculateEquipmentBonuses` already returns one entry per code, but an
 * arbitrary `SkillModifier[]` (a race's modifiers, a material level's bonuses) may repeat one.
 *
 * @param modifiers - Any list of skill modifiers
 * @returns Record of skill code to the combined modifier for that code
 */
export function indexSkillModifiers(modifiers: SkillModifier[]): Record<string, number> {
  const indexed: Record<string, number> = {};

  for (const modifier of modifiers) {
    indexed[modifier.skillCode] = (indexed[modifier.skillCode] ?? 0) + modifier.modifier;
  }

  return indexed;
}
