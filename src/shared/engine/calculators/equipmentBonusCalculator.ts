/**
 * Equipment Bonus Calculator
 *
 * What the character's equipped items are worth, **per stat** (Concept 01's equipment term,
 * TICKET-MAT-02, TICKET-INV-05). Every equipped item contributes its **material tier's** modifiers
 * plus its **inlay tier's**, and modifiers naming the same stat combine additively.
 *
 * The aggregate is keyed by stat **id** all the way through now: TICKET-MAT-01 moved the stored
 * modifier onto ids and TICKET-MAT-02 deleted the abbreviation bridge that translated them on the
 * way out. Nothing downstream matches an equipment bonus by spelling any more, so renaming a stat
 * cannot silently detach one.
 *
 * **What is equipped is a composed record now, not a catalog template** (v4 systems/12,
 * TICKET-INV-05). A slot holds a `ComposedItem.id`, that record links a template, a material tier and
 * an optional inlay tier, and every number this module produces is read off those parts at
 * calculation time. Retuning Iron Ore tier 10 therefore moves every axe made of it on the next read —
 * which is *derived values are computed, never stored* applied to the aggregate rather than to a
 * field, and the reason the record holds no numbers of its own.
 *
 * **Equipment reaches a skill two ways since TICKET-ITEM-01, and they cannot overlap.** Through the
 * stats a skill's weight rows read — a Stealth weighted on DEX moves when a cloak raises DEX — and
 * directly, through the item *template's* own per-skill vector, which the new workbook's item matrix
 * introduced (v4 systems/11). The two terms name **different entities**: a material or inlay tier's
 * modifier names a stat and a template's bonus names a skill, so neither can claim the other's share,
 * and they land on different quantities besides — the stat term composes a stat's *value*, the skill
 * term adds to a skill's *bonus*.
 *
 * **Validates: Concepts 01, 09; Requirements 13.1, 13.2, 13.4; v4 systems/11, systems/12**
 */

import type { Character, ComposedItem } from '../../types/character';
import type {
  Configuration,
  InlayTier,
  Item,
  MaterialLevel,
  StatModifier,
} from '../../types/config';

/**
 * One equipped composed item, with each of its three parts already resolved
 *
 * The template is kept whole because the skill term reads its vector; the two tiers are reduced to
 * their bonus rows, because that is the entirety of what the stat term wants from either and a
 * caller holding a whole `MaterialLevel` would be one line from reading its price.
 */
interface EquippedComposition {
  /** The template the record was built from — the ruleset still defines it */
  template: Item;
  /** The material tier's stat rows; empty when the record names no material, or none this ruleset has */
  materialBonuses: StatModifier[];
  /** The inlay tier's stat rows; empty for the sheet's "with empty inlay", and for an absent rung */
  inlayBonuses: StatModifier[];
}

/**
 * The material tier a composed record names, or nothing when it names none this ruleset has
 *
 * Looked up by `MaterialLevel.level` rather than by position in `levels`, because a family's ladder
 * carries its own rung numbers and nothing keeps the array dense or sorted.
 *
 * @param composed - The record to resolve
 * @param config - The ruleset whose materials it names
 * @returns The tier, or `undefined` when either half of the reference is absent or dangling
 */
function materialTierOf(composed: ComposedItem, config: Configuration): MaterialLevel | undefined {
  if (composed.materialId === undefined || composed.materialLevel === undefined) return undefined;

  const material = config.materials.find((candidate) => candidate.id === composed.materialId);

  return material?.levels.find((level) => level.level === composed.materialLevel);
}

/**
 * The inlay tier a composed record names, or nothing when it names none this ruleset has
 *
 * `materialTierOf`'s twin one entity over, and it has to be a search by `tier` for a sharper reason
 * than symmetry: **`Inlay.tiers` is stored in insertion order and a family's ladder may have a gap**
 * (TICKET-INL-01 — the sheet's Zircon has no tenth). Indexing the array by rung would read the wrong
 * row for the first family somebody edited out of order, and would read *some* row for a rung that
 * does not exist. An `inlayLevel` naming an absent rung resolves to nothing and therefore grants
 * nothing; telling the Player their gem has no such tier is TICKET-INV-06's picker refusal, which is
 * the surface where they can act on it.
 *
 * @param composed - The record to resolve
 * @param config - The ruleset whose inlays it names
 * @returns The tier, or `undefined` when either half of the reference is absent or dangling
 */
function inlayTierOf(composed: ComposedItem, config: Configuration): InlayTier | undefined {
  if (composed.inlayId === undefined || composed.inlayLevel === undefined) return undefined;

  const inlay = (config.inlays ?? []).find((candidate) => candidate.id === composed.inlayId);

  return inlay?.tiers.find((tier) => tier.tier === composed.inlayLevel);
}

/**
 * The composed items the character currently has equipped, one per filled slot
 *
 * **Walks the ruleset's own slot list rather than a set of keys written down anywhere**
 * (TICKET-INV-04): a ruleset's slots are User-built and free in count, so one slot, six and twelve
 * are all ordinary and none of them is the app's number. `equippedItems` is keyed by
 * `EquipmentSlot.type`, so reading it *through* `config.equipmentSlots` is what makes the count
 * follow the ruleset — and it means a slot the ruleset no longer defines equips nothing, the same
 * rule the composition applies to every other dangling reference.
 *
 * **Both equipment terms read it, which is what makes them agree** (TICKET-ITEM-01). The stat term
 * walked `Object.values(equippedItems)` until that ticket, and the difference was not theoretical:
 * `deleteEquipmentSlot` is a *guarded* delete, and `useGuardedDelete` offers the User a **Delete
 * anyway** button that re-runs it with `force: true` — so one click leaves a character holding
 * `equippedItems: { retired: 'axe-1' }`. Under two walks that axe kept granting its material's
 * `STR +2` while granting none of its skill vector: **the same item, half-counted, on one sheet.**
 * A retired slot equips nothing at all now, on either axis.
 *
 * **A record whose template is gone equips nothing either**, on both axes and for the same reason: a
 * thing built from a shape the ruleset no longer defines is not a thing. A record whose *tiers* are
 * gone is a different case and is not dropped — it is still a Battleaxe, so its skill vector still
 * counts, and only the missing tier's stat rows are absent.
 *
 * @param character - Whose inventory to read
 * @param config - The ruleset whose slots, items, materials and inlays define what is worn
 * @returns One entry per slot holding a record built from a template the ruleset still defines
 */
function equippedCompositions(character: Character, config: Configuration): EquippedComposition[] {
  const byId = new Map(character.inventory.composedItems.map((record) => [record.id, record]));
  const equipped: EquippedComposition[] = [];

  for (const slot of config.equipmentSlots) {
    const composedId = character.inventory.equippedItems[slot.type];
    if (composedId === undefined) continue;

    const composed = byId.get(composedId);
    if (composed === undefined) continue;

    const template = config.items.find((candidate) => candidate.id === composed.templateId);
    if (template === undefined) continue;

    const materialTier = materialTierOf(composed, config);
    const inlayTier = inlayTierOf(composed, config);

    equipped.push({
      template,
      materialBonuses: materialTier?.bonuses ?? [],
      inlayBonuses: inlayTier?.bonuses ?? [],
    });
  }

  return equipped;
}

/**
 * Calculate equipment bonuses from all equipped items
 *
 * **Material row + inlay row, summed per stat** (v4 systems/12, TICKET-INV-05). The two tables cover
 * different ground rather than competing for it — the workbook's material tiers move the six core
 * stats, and Mana and Speed appear on the *inlay* table alone — so a gem is the only way a ruleset
 * built from the sheet grants Mana through equipment. Nothing here knows that; it simply adds
 * whatever rows each tier has, which is what lets a ruleset that puts Mana on a metal work too.
 *
 * A modifier naming a stat the ruleset no longer defines contributes nothing rather than inventing
 * a target — the same rule the stat composition applies to a dangling race stat block entry
 * (TICKET-REF-02). The ruleset alone decides what exists, and that includes which *slots* exist:
 * this reads {@link equippedCompositions} like the skill term beside it, so a slot the User
 * force-deleted under an equipped character equips nothing on either axis instead of half-counting
 * one item.
 *
 * @param character - The character whose equipment to evaluate
 * @param config - The ruleset holding the slots, the items, the materials and the inlays
 * @returns One modifier per stat that any equipped item touches, totalled
 */
export function calculateEquipmentBonuses(
  character: Character,
  config: Configuration
): StatModifier[] {
  const statIds = new Set(config.stats.map((stat) => stat.id));
  const bonusMap: Record<string, number> = {};

  for (const { materialBonuses, inlayBonuses } of equippedCompositions(character, config)) {
    for (const bonus of [...materialBonuses, ...inlayBonuses]) {
      if (!statIds.has(bonus.statId)) continue;

      bonusMap[bonus.statId] = (bonusMap[bonus.statId] ?? 0) + bonus.modifier;
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
 * `calculateEquipmentBonuses`' rule, one entity over, off the same {@link equippedCompositions} walk
 * so the two cannot disagree about what is worn.
 *
 * **The vector belongs to the template, not to the build** (TICKET-INV-05): every Battleaxe makes its
 * bearer better at Athletics whatever it is forged from, so this reads `template` off the composition
 * and the material and inlay tiers beside it are the stat term's business alone.
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

  for (const { template } of equippedCompositions(character, config)) {
    for (const bonus of template.skillBonuses ?? []) {
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
