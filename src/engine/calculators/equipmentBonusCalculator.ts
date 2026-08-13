/**
 * Equipment Bonus Calculator
 *
 * What the character's equipped items are worth, **per stat** (Concept 01's equipment term,
 * TICKET-MAT-02). Every equipped item contributes its material tier's modifiers, and modifiers
 * naming the same stat combine additively.
 *
 * The aggregate is keyed by stat **id** all the way through now: TICKET-MAT-01 moved the stored
 * modifier onto ids and this ticket deleted the abbreviation bridge that translated them on the
 * way out. Nothing downstream matches an equipment bonus by spelling any more, so renaming a stat
 * cannot silently detach one.
 *
 * **Equipment reaches a skill only through the stats its formula reads.** A speciality or combat
 * skill takes no equipment term of its own — there is no shape left that could name one — which is
 * the sheet's model rather than a regression: a Stealth that reads DEX moves when a cloak raises
 * DEX.
 *
 * **Validates: Concepts 01, 09; Requirements 13.1, 13.2, 13.4**
 */

import type { Character } from '../../types/character';
import type { Configuration, StatModifier } from '../../types/config';

/**
 * Calculate equipment bonuses from all equipped items
 *
 * A modifier naming a stat the ruleset no longer defines contributes nothing rather than inventing
 * a target — the same rule the stat composition applies to a dangling race stat block entry
 * (TICKET-REF-02). The ruleset alone decides what exists.
 *
 * @param character - The character whose equipment to evaluate
 * @param config - The game configuration containing items and materials
 * @returns One modifier per stat that any equipped item touches, totalled
 */
export function calculateEquipmentBonuses(
  character: Character,
  config: Configuration
): StatModifier[] {
  const statIds = new Set(config.stats.map((stat) => stat.id));
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
        if (!statIds.has(bonus.statId)) continue;

        bonusMap[bonus.statId] = (bonusMap[bonus.statId] ?? 0) + bonus.modifier;
      }
    }
  }

  return Object.entries(bonusMap).map(([statId, modifier]) => ({ statId, modifier }));
}

/**
 * Index stat modifiers by stat id
 *
 * The character sheet has to show each stat's equipment contribution separately from its base
 * (Requirement 13.4), which means a per-stat lookup rather than a list. Doing it here keeps the
 * summing in the engine — `calculateEquipmentBonuses` already returns one entry per stat, but an
 * arbitrary `StatModifier[]` (a material level's own bonuses) may repeat one.
 *
 * @param modifiers - Any list of stat modifiers
 * @returns Record of stat id to the combined modifier for that stat
 */
export function indexStatModifiers(modifiers: StatModifier[]): Record<string, number> {
  const indexed: Record<string, number> = {};

  for (const modifier of modifiers) {
    indexed[modifier.statId] = (indexed[modifier.statId] ?? 0) + modifier.modifier;
  }

  return indexed;
}
