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
import { focusPickRefusal, focusPicksField, focusPicksOf } from '../engine/focusSkills';
import { asNumber, isFormulaError } from '../engine/formula/errors';
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
 * Whether a proposed allocation fits the one pool, and what to say when it does not
 *
 * **Shared by both investment actions since TICKET-RES-05**, which is when the pool stopped being a
 * stat-only budget: `level × const.points_per_level + grants` now prices the stat boxes and the
 * skill boxes together, the way the source sheet's `Points Spend` always has. Refusing a skill
 * spend and refusing a stat spend became the same question asked of the same verdict, so asking it
 * twice in two spellings was how the two would start disagreeing.
 *
 * The verdict is `validateStatAllocation`'s, so the sheet, the creation wizard, the server and this
 * cannot differ about what a point costs. A budget that cannot be *priced* — a ruleset with no
 * `xp_thresholds` curve, say — lands here as `isValid: false`, which is the right answer rather
 * than an accident: a ruleset that cannot say how many points exist cannot say this spend is
 * allowed either.
 *
 * **The overspend is named** (RES-02's and DM-01's discipline): a Player told *no* with no number
 * has nothing to act on, and `setGrantedPoints` has said "would leave them 4 points overspent"
 * since DM-01.
 *
 * @param character Whose sheet, as it stands
 * @param proposed The same character with the spend applied
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @returns The refusal, or null when the spend may go through
 */
function affordabilityRefusal(
  character: Character,
  proposed: Character,
  config: Configuration
): string | null {
  const after = validateStatAllocation(proposed, config);

  if (after.isValid) return null;

  /*
   * A change that *lowers* the total spend is never refused, whatever state the sheet is in.
   *
   * Widening the pool to cover skills makes an over-budget character an ordinary thing to meet —
   * every character built while skill investment was free is one, which is exactly what this
   * ticket's acceptance criteria ask to be *reported* rather than rewritten. A refusal that also
   * blocked the refund would leave a Player reading a report they have no way to act on, and
   * `StatsSection` has drawn `−` as always-open since RES-02 on precisely this reasoning.
   */
  const current = validateStatAllocation(character, config);

  if (after.pointsSpent < current.pointsSpent) return null;

  const remaining = after.pointsRemaining;

  if (!after.isOverBudget || isFormulaError(remaining)) {
    return (
      'That spend is more than the points this character has. Free some points up, or gain a ' +
      'level first.'
    );
  }

  const overspend = -remaining;
  const plural = overspend === 1 ? '' : 's';

  return (
    `That spend goes ${overspend} point${plural} over the budget. Free some points up, or gain a ` +
    'level first.'
  );
}

/**
 * Put points into one invested stat (Requirement 14.5, TICKET-RES-02)
 *
 * A **refusal** rather than a clamp: silently spending fewer points than asked would leave a Player
 * believing an investment landed. What counts as affordable is {@link affordabilityRefusal}'s.
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

  const unaffordable = affordabilityRefusal(character, proposed, config);
  if (unaffordable) return { refusal: unaffordable };

  return { character: proposed, before, after: points };
}

/**
 * Put points into one skill
 *
 * **Budgeted since TICKET-RES-05**, and that is the behavioural change the ticket is about: this
 * used to check nothing but the shape of the number, because the app priced stat points only and a
 * Player could raise forty skills at level 1 for free. The source sheet has always paid for both
 * out of the one `level × 3` pool, so the same {@link affordabilityRefusal} the stat side asks now
 * stands here too — the ruleset needs no skill-specific rule, because there is no skill-specific
 * pool.
 *
 * The `config` parameter is what that cost: the browser's store and the server's route both hand
 * their ruleset in, exactly as the stat counterpart has since TICKET-RES-02.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @param skillId Which skill
 * @param points The new total for that skill
 * @returns The character with the spend applied, or the reason it was refused
 */
export function investInSkill(
  character: Character,
  config: Configuration,
  skillId: string,
  points: number
): PlayerActionResult {
  const shape = pointsRefusal(points);
  if (shape) return { refusal: shape };

  const before = character.investedSkillPoints[skillId] ?? 0;

  const proposed: Character = {
    ...character,
    investedSkillPoints: { ...character.investedSkillPoints, [skillId]: points },
  };

  const unaffordable = affordabilityRefusal(character, proposed, config);
  if (unaffordable) return { refusal: unaffordable };

  return { character: proposed, before, after: points };
}

/**
 * Choose the skills this character focuses on (TICKET-SKL-05)
 *
 * **The whole list, not one slot**, because the multiplier is a sum over the slots and therefore
 * indifferent to which slot a pick sits in: a slot-addressed write would need an empty-slot sentinel
 * stored on the character to say *slot 2 is filled and slot 1 is not*, which is a shape the field
 * does not have and nothing would read. The picker sends what the three boxes currently name, with
 * the empty ones left out, so the picks compact to the front.
 *
 * **What may be stored is [`focusPickRefusal`](../engine/focusSkills.ts)'s** — at most three, every
 * one a skill this ruleset defines — the same call `characterCreationErrors` makes, so a live edit and
 * a creation cannot disagree. It deliberately does *not* insist on three: a character created before
 * focus skills existed has none, and this is the affordance that lets them fill the slots one at a
 * time (the ticket's own note).
 *
 * **Clearing the last pick removes the field rather than storing `[]`** — `focusPicksField`'s rule,
 * which is the same one `buildCharacter` follows, so a character who gave up their focus and one who
 * never had any are the same document. The old key is dropped before the new one is spread, because
 * an absent field spread over a present one leaves it exactly where it was.
 *
 * `before` and `after` are the picks joined, which is the readable form of a list in an Event log
 * whose values are a number, an id or nothing.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @param focusSkillIds The skills now named, in slot order
 * @returns The character with the picks applied, or the reason they were refused
 */
export function chooseFocusSkills(
  character: Character,
  config: Configuration,
  focusSkillIds: string[]
): PlayerActionResult {
  const refusal = focusPickRefusal(focusSkillIds, config);
  if (refusal) return { refusal };

  const previous = focusPicksOf(character);
  const before = previous.join(', ');
  const after = focusSkillIds.join(', ');

  const { focusSkillIds: _replaced, ...withoutPicks } = character;
  const updated: Character = { ...withoutPicks, ...focusPicksField(focusSkillIds) };

  return { character: updated, before, after };
}

/**
 * Set what a character is carrying, in the ruleset's base tier (v3 Req 43.1, 43.4, TICKET-CUR-02)
 *
 * **Below zero is a refusal that names the shortfall, not a clamp to nothing.** That is
 * `deductExperience`'s precedent and it is the same reasoning: a purchase that quietly took a
 * character to 0 instead of refusing would leave a table believing it had been paid for. Owing money
 * may well be a mechanic a ruleset wants, but inventing it here silently is worse than not having
 * it.
 *
 * **Fractions pass.** A tier rate may be fractional, so half a gold is an ordinary amount to hold
 * and rounding here would lose money the ruleset had authored.
 *
 * @param character Whose purse
 * @param amount The new balance, in the base tier
 * @returns The character carrying it, or the reason it was refused
 */
export function setPurseAmount(character: Character, amount: number): PlayerActionResult {
  if (!Number.isFinite(amount)) return { refusal: 'That is not an amount of money.' };

  const before = character.purse ?? 0;

  if (amount < 0) {
    return {
      refusal: `That would leave the purse ${short(amount)} short. Nothing was taken.`,
    };
  }

  return { character: { ...character, purse: amount }, before, after: amount };
}

/**
 * Move a purse by a delta rather than setting it (Concept 20's quick entry)
 *
 * `-7` off a purse of 30 leaves 23, and `-40` is refused rather than emptying it.
 *
 * @param character Whose purse
 * @param delta How much to add or take
 * @returns The character with the money moved, or the reason it was refused
 */
export function adjustPurseBy(character: Character, delta: number): PlayerActionResult {
  if (!Number.isFinite(delta)) return { refusal: 'That is not an amount of money.' };

  return setPurseAmount(character, (character.purse ?? 0) + delta);
}

/** How far past zero an amount went, rounded for reading rather than for arithmetic */
function short(amount: number): number {
  return Number(Math.abs(amount).toFixed(2));
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
