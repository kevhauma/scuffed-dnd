/**
 * The rules behind every write a Player makes to their own sheet (TICKET-PLY-01)
 *
 * `characterCreation.ts`'s counterpart for everything that happens *after* creation. Until this
 * module existed each of these rules lived in `client/stores/characterStore.ts` — which is a place
 * the server cannot reach, so a route enforcing them would have been a second implementation of
 * every one, and D5 says a rule is written once.
 *
 * ## The names here describe the document; `PLAYER_ACTION`'s describe the act
 *
 * `equipToSlot`, `emptySlot`, `addToPack`, `investInStat` — a rule says what it does to a
 * `Character`. The route that reaches it is named for what the person at the table did:
 * `equip-item`, `unequip-item`, `take-item`, `invest-stat-points`. Keeping the two vocabularies
 * apart is not decoration — `fallow` reported the first draft's six shared spellings as duplicate
 * exports, which is the same finding GAM-01 got for `toSummary` and the same fix.
 *
 * ## The shape, and why each function reports a refusal rather than returning `null`
 *
 * The browser has a wizard and a set of disabled controls standing in front of these, so its store
 * has always been able to decline silently — nothing reaches `setInvestedStatPoints` with a
 * fractional number unless something else is already broken. The **server** has nothing in front of
 * it, and v3 Req 41 asks that a refused action come back with the reason it was refused. One return
 * type serves both: the store ignores the sentence, the route turns it into a 400.
 *
 * ## Before and after, on every accepted change
 *
 * Every result carries what the value *was* and what it *became*, because
 * [TICKET-PLY-01](../../../docs/v3.0_backend/tickets/TICKET-PLY-01-player-actions-through-the-server.md)
 * writes an Event per accepted action and DM-01's audit and LIVE-02's reconciliation both read those
 * two numbers rather than re-reading the whole character. They are produced here rather than in the
 * route because only this module knows what each action actually moved.
 *
 * **Nothing here reads a clock.** `updatedAt` is stamped by whichever root persists the result —
 * the store on the LocalStorage path, the route on the server one — which is what keeps these pure.
 *
 * **Validates: v3 Req 41.1, 41.2, 41.3, 41.4, 41.5, 45.1; Requirements 12.3, 14.3, 14.4**
 */

import { calculateCharacter } from '../engine/calculator';
import { asNumber } from '../engine/formula/errors';
import { validateStatAllocation } from '../engine/skillAllocation';
import type { ActionValue } from '../types/api';
import type { Character, Inventory } from '../types/character';
import type { Configuration } from '../types/config';

/** An accepted action: the character as it now is, and what changed */
export interface PlayerActionChange {
  character: Character;
  before: ActionValue;
  after: ActionValue;
}

/** A refused action: why, in words a Player can act on */
export interface PlayerActionRefusal {
  refusal: string;
}

/** What every function here answers */
export type PlayerActionResult = PlayerActionChange | PlayerActionRefusal;

/**
 * Whether an action was refused
 *
 * A type guard rather than a `'refusal' in result` at each call site, because there are eleven of
 * them across the two roots and narrowing a union is exactly what this is for.
 */
export function isRefusal(result: PlayerActionResult): result is PlayerActionRefusal {
  return 'refusal' in result;
}

/**
 * A whole, non-negative number of points, or the reason it is not one
 *
 * Shared by the two investment actions because they differ only in which map they write to. The
 * wording names the value rather than the field, so one sentence serves both.
 */
function pointsRefusal(points: number): string | null {
  if (!Number.isInteger(points)) return 'Points have to be a whole number.';
  if (points < 0) return 'Points cannot go below 0.';
  return null;
}

/**
 * Put points into one invested stat (Requirement 14.5, TICKET-RES-02)
 *
 * The affordability verdict is `validateStatAllocation`'s, so the sheet, the creation wizard and
 * this cannot disagree about what the budget is. It is a **refusal** rather than a clamp: silently
 * spending fewer points than asked would leave a Player believing an investment landed.
 *
 * A budget that cannot be *priced* — a ruleset with no `xp_thresholds` curve, say — lands here as
 * `isValid: false`, which is the right answer rather than an accident: a ruleset that cannot say
 * how many points exist cannot say this spend is allowed either.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @param statId Which stat
 * @param points The new total for that stat, not a delta
 * @returns The character with the spend applied, or the reason it was refused
 */
export function investInStat(
  character: Character,
  config: Configuration,
  statId: string,
  points: number
): PlayerActionResult {
  const shape = pointsRefusal(points);
  if (shape) return { refusal: shape };

  const before = character.investedStatPoints[statId] ?? 0;

  const proposed: Character = {
    ...character,
    investedStatPoints: { ...character.investedStatPoints, [statId]: points },
  };

  if (!validateStatAllocation(proposed, config).isValid) {
    return {
      refusal:
        'That spend is more than the points this character has. Free some points up, or gain a ' +
        'level first.',
    };
  }

  return { character: proposed, before, after: points };
}

/**
 * Put points into one skill
 *
 * **Deliberately not budgeted**, unlike its stat counterpart: the ruleset prices stat points and
 * says nothing about skill points, so the only rule is the shape of the number. The creation wizard
 * has always let a Player type any number into a skill, and refusing here would make the sheet
 * stricter than the wizard that produced the character.
 *
 * @param character Whose sheet
 * @param skillId Which skill
 * @param points The new total for that skill
 * @returns The character with the spend applied, or the reason it was refused
 */
export function investInSkill(
  character: Character,
  skillId: string,
  points: number
): PlayerActionResult {
  const shape = pointsRefusal(points);
  if (shape) return { refusal: shape };

  const before = character.investedSkillPoints[skillId] ?? 0;

  return {
    character: {
      ...character,
      investedSkillPoints: { ...character.investedSkillPoints, [skillId]: points },
    },
    before,
    after: points,
  };
}

/**
 * One stat's calculated maximum, or `undefined` when there isn't one
 *
 * `undefined` covers an unknown id, a ruleset whose formulas do not evaluate, and an engine that
 * threw — three ways of having no ceiling, all of which mean the same thing to a caller.
 */
function maxOf(character: Character, config: Configuration, statId: string): number | undefined {
  try {
    return asNumber(calculateCharacter(character, config).statValues[statId]);
  } catch {
    return undefined;
  }
}

/** The stat a resource action names, when the ruleset has one and it really is a pool */
function resourceRefusal(config: Configuration, statId: string): string | null {
  const stat = config.stats.find((candidate) => candidate.id === statId);

  if (!stat) return 'This ruleset has no such stat.';
  if (!stat.isResource) return `${stat.name} is not a pool, so it has no current value.`;

  return null;
}

/**
 * Write where a resource pool currently stands (Requirements 14.3, 14.4)
 *
 * **Clamped at the top and open at the bottom**, which is the one-sided shape the requirements ask
 * for: a current value may not exceed its derived maximum, and it *may* go negative, because a
 * table that tracks bleeding out needs somewhere to put it.
 *
 * A stat with no calculable maximum is written through unclamped — refusing would leave a Player
 * unable to track anything on a ruleset whose formulas are broken, and the surface reports the
 * formula error separately.
 *
 * A stored current already **above** a fallen maximum is not rewritten by this: the clamp applies to
 * the value being written, so the Player's own write is what resolves the state (TICKET-RES-03).
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param statId Which pool
 * @param value Where it now stands
 * @returns The character with the pool moved, or the reason it was refused
 */
export function setResourceValue(
  character: Character,
  config: Configuration,
  statId: string,
  value: number
): PlayerActionResult {
  if (!Number.isFinite(value)) return { refusal: 'That is not a number.' };

  const wrongStat = resourceRefusal(config, statId);
  if (wrongStat) return { refusal: wrongStat };

  const max = maxOf(character, config, statId);
  const after = max === undefined ? value : Math.min(value, max);
  const before = character.currentResourceValues[statId] ?? 0;

  return {
    character: {
      ...character,
      currentResourceValues: { ...character.currentResourceValues, [statId]: after },
    },
    before,
    after,
  };
}

/**
 * Move a resource pool by a delta rather than setting it (Concept 20's quick entry)
 *
 * `-7` off a pool of 30 leaves 23. The delta applies to what is **stored**, not to what a surface
 * happens to be showing, so a pool left above a shrunken maximum loses exactly what was asked for.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param statId Which pool
 * @param delta How far to move it
 * @returns The character with the pool moved, or the reason it was refused
 */
export function adjustResourceValue(
  character: Character,
  config: Configuration,
  statId: string,
  delta: number
): PlayerActionResult {
  if (!Number.isFinite(delta)) return { refusal: 'That is not a number.' };

  const current = character.currentResourceValues[statId] ?? 0;

  return setResourceValue(character, config, statId, current + delta);
}

/**
 * Fill a resource pool to its calculated maximum — Concept 20's "Regain mana to full"
 *
 * The maximum is derived, so this is the one write that reads it: a pool whose formula cannot be
 * evaluated has no maximum to reset to, and is refused rather than zeroed. Writing 0 would be the
 * one case where *reset* empties a pool instead of filling it.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param statId Which pool
 * @returns The character with the pool full, or the reason it was refused
 */
export function resetResourceToMax(
  character: Character,
  config: Configuration,
  statId: string
): PlayerActionResult {
  const wrongStat = resourceRefusal(config, statId);
  if (wrongStat) return { refusal: wrongStat };

  const max = maxOf(character, config, statId);

  if (max === undefined) {
    return {
      refusal: "This ruleset cannot work out that pool's maximum, so there is nothing to fill to.",
    };
  }

  return setResourceValue(character, config, statId, max);
}

/**
 * Whether an item may occupy an equipment slot (Requirement 12.3)
 *
 * An item goes in the slot type it declares, and only that one. An item the ruleset does not define,
 * and one with no `equipmentSlotType` at all, fit nowhere — a strict equality against the declared
 * type covers both.
 *
 * **The slot has to exist too**, which the browser's store never checked because its own dropdowns
 * are built from the ruleset's slot list. A request is not a dropdown, and an item still naming a
 * slot type the ruleset has since deleted would otherwise be equippable into a slot no surface can
 * show.
 */
function slotRefusal(
  config: Configuration,
  equipmentSlotType: string,
  itemId: string
): string | null {
  if (!config.equipmentSlots.some((slot) => slot.type === equipmentSlotType)) {
    return 'This ruleset has no such equipment slot.';
  }

  const item = config.items.find((candidate) => candidate.id === itemId);

  if (!item) return 'This ruleset has no such item.';
  if (item.equipmentSlotType !== equipmentSlotType) {
    return `${item.name} does not go in that slot.`;
  }

  return null;
}

/** An equipped-items map with one slot emptied */
function withoutSlot(
  equippedItems: Inventory['equippedItems'],
  equipmentSlotType: string
): Inventory['equippedItems'] {
  return Object.fromEntries(
    Object.entries(equippedItems).filter(([slotType]) => slotType !== equipmentSlotType)
  );
}

/** The character with a replacement inventory */
function withInventory(character: Character, inventory: Inventory): Character {
  return { ...character, inventory };
}

/**
 * Put an item in an equipment slot (Requirement 12.3)
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param equipmentSlotType Which slot
 * @param itemId What to put in it
 * @returns The character wearing it, or the reason it was refused
 */
export function equipToSlot(
  character: Character,
  config: Configuration,
  equipmentSlotType: string,
  itemId: string
): PlayerActionResult {
  const wrongSlot = slotRefusal(config, equipmentSlotType, itemId);
  if (wrongSlot) return { refusal: wrongSlot };

  const before = character.inventory.equippedItems[equipmentSlotType] ?? null;

  return {
    character: withInventory(character, {
      ...character.inventory,
      equippedItems: { ...character.inventory.equippedItems, [equipmentSlotType]: itemId },
    }),
    before,
    after: itemId,
  };
}

/**
 * Take whatever is in an equipment slot off, dropping it entirely
 *
 * The counterpart of {@link moveItemToMisc}, which keeps it. Both exist because taking a helmet off
 * and putting it in the pack are different things to do with it.
 *
 * @param character Whose sheet
 * @param equipmentSlotType Which slot
 * @returns The character with the slot empty, or the reason it was refused
 */
export function emptySlot(character: Character, equipmentSlotType: string): PlayerActionResult {
  const before = character.inventory.equippedItems[equipmentSlotType] ?? null;

  if (before === null) return { refusal: 'There is nothing in that slot.' };

  return {
    character: withInventory(character, {
      ...character.inventory,
      equippedItems: withoutSlot(character.inventory.equippedItems, equipmentSlotType),
    }),
    before,
    after: null,
  };
}

/**
 * Move an equipped item into the pack
 *
 * @param character Whose sheet
 * @param equipmentSlotType Which slot to empty
 * @returns The character carrying it instead of wearing it, or the reason it was refused
 */
export function moveItemToMisc(
  character: Character,
  equipmentSlotType: string
): PlayerActionResult {
  const before = character.inventory.equippedItems[equipmentSlotType] ?? null;

  if (before === null) return { refusal: 'There is nothing in that slot.' };

  return {
    character: withInventory(character, {
      equippedItems: withoutSlot(character.inventory.equippedItems, equipmentSlotType),
      miscItems: [...character.inventory.miscItems, before],
    }),
    before,
    after: null,
  };
}

/**
 * Put an item in the pack
 *
 * **The ruleset has to define it**, which the browser's store never checked because its own picker
 * is built from the ruleset's item list. A request is not a picker, and a pack holding an id nothing
 * can resolve is a row every surface renders as a blank.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param itemId What to pick up
 * @returns The character carrying it, or the reason it was refused
 */
export function addToPack(
  character: Character,
  config: Configuration,
  itemId: string
): PlayerActionResult {
  if (!config.items.some((item) => item.id === itemId)) {
    return { refusal: 'This ruleset has no such item.' };
  }

  return {
    character: withInventory(character, {
      ...character.inventory,
      miscItems: [...character.inventory.miscItems, itemId],
    }),
    before: null,
    after: itemId,
  };
}

/**
 * Take an item out of the pack
 *
 * **Every copy of it goes**, which is v1.0's behaviour rather than a decision taken here: the pack
 * is a list of ids with no quantities, so a character carrying two of something has two identical
 * entries and nothing distinguishes them. Quantities are their own feature.
 *
 * @param character Whose sheet
 * @param itemId What to put down
 * @returns The character without it, or the reason it was refused
 */
export function removeFromPack(character: Character, itemId: string): PlayerActionResult {
  if (!character.inventory.miscItems.includes(itemId)) {
    return { refusal: 'That is not in the pack.' };
  }

  return {
    character: withInventory(character, {
      ...character.inventory,
      miscItems: character.inventory.miscItems.filter((id) => id !== itemId),
    }),
    before: itemId,
    after: null,
  };
}

/**
 * Move an item out of the pack and into an equipment slot
 *
 * A slot holds one item, so whatever was in it swaps back into the pack rather than vanishing.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param itemId What to put on
 * @param equipmentSlotType Where
 * @returns The character wearing it, or the reason it was refused
 */
export function moveItemToEquipment(
  character: Character,
  config: Configuration,
  itemId: string,
  equipmentSlotType: string
): PlayerActionResult {
  const wrongSlot = slotRefusal(config, equipmentSlotType, itemId);
  if (wrongSlot) return { refusal: wrongSlot };

  const { equippedItems, miscItems } = character.inventory;
  const displaced = equippedItems[equipmentSlotType];
  const remaining = miscItems.filter((id) => id !== itemId);

  return {
    character: withInventory(character, {
      equippedItems: { ...equippedItems, [equipmentSlotType]: itemId },
      miscItems: displaced ? [...remaining, displaced] : remaining,
    }),
    before: displaced ?? null,
    after: itemId,
  };
}
