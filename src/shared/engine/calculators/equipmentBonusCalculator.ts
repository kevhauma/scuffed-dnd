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
 * **Equipment reaches a skill two ways since TICKET-ITEM-01, and they cannot overlap.** Through the
 * stats a skill's weight rows read — a Stealth weighted on DEX moves when a cloak raises DEX — and
 * directly, through the item *template's* own per-skill vector, which the new workbook's item matrix
 * introduced (v4 systems/11). The two terms name **different entities**: a material tier's modifier
 * names a stat and a template's bonus names a skill, so neither can claim the other's share, and
 * they land on different quantities besides — the stat term composes a stat's *value*, the skill
 * term adds to a skill's *bonus*.
 *
 * **Validates: Concepts 01, 09; Requirements 13.1, 13.2, 13.4; v4 systems/11**
 */

import type { Character } from '../../types/character';
import type { Configuration, Item, StatModifier } from '../../types/config';

/**
 * The templates the character currently has equipped, one per filled slot
 *
 * **Walks the ruleset's own slot list rather than a set of keys written down anywhere**
 * (TICKET-INV-04): a ruleset's slots are User-built and free in count, so one slot, six and twelve
 * are all ordinary and none of them is the app's number. `equippedItems` is keyed by
 * `EquipmentSlot.type`, so reading it *through* `config.equipmentSlots` is what makes the count
 * follow the ruleset — and it means a slot the ruleset no longer defines equips nothing, the same
 * rule the composition applies to every other dangling reference.
 *
 * **Both equipment terms read it, which is what makes them agree** (TICKET-ITEM-01). The stat term
 * walked `Object.values(equippedItems)` until this ticket, and the difference was not theoretical:
 * `deleteEquipmentSlot` is a *guarded* delete, and `useGuardedDelete` offers the User a **Delete
 * anyway** button that re-runs it with `force: true` — so one click leaves a character holding
 * `equippedItems: { retired: 'item-sword' }`. Under two walks that sword kept granting its material's
 * `STR +2` while granting none of its skill vector: **the same item, half-counted, on one sheet.**
 * A retired slot equips nothing at all now, on either axis, which is the rule the composition already
 * applies to every other dangling reference.
 *
 * @param character - Whose inventory to read
 * @param config - The ruleset whose slots and items define what is equipped
 * @returns One item per slot holding a template the ruleset still defines
 */
function equippedTemplates(character: Character, config: Configuration): Item[] {
  const equipped: Item[] = [];

  for (const slot of config.equipmentSlots) {
    const itemId = character.inventory.equippedItems[slot.type];
    if (itemId === undefined) continue;

    const item = config.items.find((candidate) => candidate.id === itemId);
    if (item) equipped.push(item);
  }

  return equipped;
}

/**
 * Calculate equipment bonuses from all equipped items
 *
 * A modifier naming a stat the ruleset no longer defines contributes nothing rather than inventing
 * a target — the same rule the stat composition applies to a dangling race stat block entry
 * (TICKET-REF-02). The ruleset alone decides what exists, and since TICKET-ITEM-01 that includes
 * which *slots* exist: this reads {@link equippedTemplates} like the skill term beside it, so a
 * slot the User force-deleted under an equipped character equips nothing on either axis instead of
 * half-counting one item.
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

  for (const item of equippedTemplates(character, config)) {
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
 * What the character's equipped templates are worth **per skill** (v4 systems/11, TICKET-ITEM-01)
 *
 * The new workbook's item matrix: a template is a vector of small signed integers over the ruleset's
 * skills, and a wielded Battleaxe makes its bearer better at Athletics and worse at Sneaking. Every
 * equipped slot contributes its template's vector and bonuses naming one skill combine additively —
 * `calculateEquipmentBonuses`' rule, one entity over, off the same {@link equippedTemplates} walk so
 * the two cannot disagree about what is worn.
 *
 * **The result is a per-skill lookup rather than a list**, unlike the stat side: it has exactly one
 * consumer (`calculateSkills`, which asks per skill), so returning rows and indexing them again
 * would be a shape nobody wants and a second `indexStatModifiers` to maintain.
 *
 * A bonus naming a skill the ruleset no longer defines contributes nothing rather than inventing a
 * target — the ruleset alone decides what exists. A template with no vector at all contributes
 * nothing either, which is what makes the field additive: a ruleset whose items predate the matrix
 * computes exactly as it did.
 *
 * @param character - The character whose equipment to evaluate
 * @param config - The ruleset holding the slots, the items and the skills
 * @returns The total bonus per skill id, for the skills any equipped template touches
 */
export function calculateEquipmentSkillBonuses(
  character: Character,
  config: Configuration
): Record<string, number> {
  const skillIds = new Set(config.skills.map((skill) => skill.id));
  const bonuses: Record<string, number> = {};

  for (const item of equippedTemplates(character, config)) {
    for (const bonus of item.skillBonuses ?? []) {
      if (!skillIds.has(bonus.skillId)) continue;

      bonuses[bonus.skillId] = (bonuses[bonus.skillId] ?? 0) + bonus.modifier;
    }
  }

  return bonuses;
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
