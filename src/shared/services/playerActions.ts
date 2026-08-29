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
import type { Character, ComposedItem, Inventory } from '../types/character';
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
 * The build an inventory id names, or nothing when this character has no such thing
 *
 * Every id in `equippedItems` and `miscItems` is a {@link ComposedItem.id} since TICKET-INV-05, so
 * *what is this* is a lookup on the character rather than on the ruleset. The template it was built
 * from is the ruleset's business, one step further on.
 */
function buildOf(character: Character, composedId: string): ComposedItem | undefined {
  return character.inventory.composedItems.find((record) => record.id === composedId);
}

/**
 * Whether a built item may occupy an equipment slot (Requirement 12.3)
 *
 * A build goes in the slot type its **template** declares, and only that one. A template the ruleset
 * does not define, and one with no `equipmentSlotType` at all, fit nowhere — a strict equality
 * against the declared type covers both.
 *
 * **The slot has to exist too**, which the browser's store never checked because its own dropdowns
 * are built from the ruleset's slot list. A request is not a dropdown, and a template still naming a
 * slot type the ruleset has since deleted would otherwise be equippable into a slot no surface can
 * show.
 *
 * **And the character has to actually have the thing** (TICKET-INV-05). That is new, and it is not
 * strictness for its own sake: an id here used to name a catalog template, which every character
 * could equip by definition, and now it names one Player's build. A request naming somebody else's
 * axe — or an id nobody's — would otherwise fill a slot with a record the inventory does not hold,
 * which every reader would resolve to nothing.
 */
function slotRefusal(
  character: Character,
  config: Configuration,
  equipmentSlotType: string,
  composedId: string
): string | null {
  if (!config.equipmentSlots.some((slot) => slot.type === equipmentSlotType)) {
    return 'This ruleset has no such equipment slot.';
  }

  const composed = buildOf(character, composedId);

  if (!composed) return 'This character has no such item.';

  const template = config.items.find((candidate) => candidate.id === composed.templateId);

  if (!template) return 'This ruleset has no such item.';
  if (template.equipmentSlotType !== equipmentSlotType) {
    return `${template.name} does not go in that slot.`;
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

/**
 * The slot map with one build worn in `equipmentSlotType` and **nowhere else** (TICKET-INV-05)
 *
 * A build is one thing, so it is worn in at most one slot and never worn and carried at the same
 * time. Under the old model an id could legitimately be in two places at once, because it named a
 * catalog *template*: two of a thing were the same id twice and indistinguishable. A build has its
 * own identity, so the same id in two slots is one object in two places — and the pack half of that
 * is not hypothetical, it is what equipping something you were already carrying used to leave behind.
 *
 * The **caller** drops it from `miscItems`; this drops it from any slot it was already in.
 */
function wearingOnly(
  equippedItems: Inventory['equippedItems'],
  equipmentSlotType: string,
  composedId: string
): Inventory['equippedItems'] {
  const elsewhere = Object.entries(equippedItems).filter(([, id]) => id !== composedId);
  const slots = Object.fromEntries(elsewhere);

  return { ...slots, [equipmentSlotType]: composedId };
}

/**
 * The builds a character keeps, with one forgotten (TICKET-INV-05)
 *
 * Reached by the two actions that **destroy** a thing rather than move it — dropping what is worn,
 * and taking something out of the pack. Leaving the record behind would be an orphan: a build in
 * `composedItems` that nothing wears and nothing carries, invisible to every surface and still
 * blocking the delete of the material it was made of.
 */
function withoutBuild(inventory: Inventory, composedId: string): ComposedItem[] {
  return inventory.composedItems.filter((record) => record.id !== composedId);
}

/** The character with a replacement inventory */
function withInventory(character: Character, inventory: Inventory): Character {
  return { ...character, inventory };
}

/**
 * Take whatever is in a slot off, and do one thing with what came off
 *
 * **The two ways to empty a slot differ only in where the build goes** — destroyed, or into the
 * pack — and everything else about them is the same four lines: read the occupant, refuse an empty
 * slot, clear the slot, report `before` and a `null` after. That was a near-duplicate before
 * TICKET-INV-05 and a literal one after it, because dropping gained a second collection to touch.
 *
 * Extracted to delete an actual clone rather than in anticipation of a third caller, which is the
 * distinction the no-abstraction-before-the-third-caller rule draws.
 *
 * @param character Whose sheet
 * @param equipmentSlotType Which slot to empty
 * @param place What to do with the build that came off, as the inventory fields it replaces
 * @returns The character with the slot empty, or the reason it was refused
 */
function takeOff(
  character: Character,
  equipmentSlotType: string,
  place: (inventory: Inventory, composedId: string) => Partial<Inventory>
): PlayerActionResult {
  const { inventory } = character;
  const before = inventory.equippedItems[equipmentSlotType] ?? null;

  if (before === null) return { refusal: 'There is nothing in that slot.' };

  const placed = place(inventory, before);

  return {
    character: withInventory(character, {
      ...inventory,
      equippedItems: withoutSlot(inventory.equippedItems, equipmentSlotType),
      ...placed,
    }),
    before,
    after: null,
  };
}

/**
 * Put a built item in an equipment slot (Requirement 12.3)
 *
 * ## Whatever it displaces goes into the pack
 *
 * **Not destroyed, and not left nowhere** (the TICKET-INV-05 review's blocking find). This wrote the
 * new occupant into the slot and did nothing at all with the old one, which was harmless while an id
 * named a catalog *template* — the displaced id still named something the ruleset defined, and the
 * Player had lost nothing. Once the id names a **build**, the same code leaves a record in
 * `composedItems` that nothing wears and nothing carries: invisible to every surface, and still
 * counted by `composedItemReferences`, so the material it was made of becomes **permanently
 * undeletable** with a refusal naming a Player who cannot see the thing.
 *
 * Of the two honest answers — destroy it, as {@link emptySlot} does, or stow it, as
 * {@link moveItemToEquipment} does — **stow is the right one here**: the Player asked to put
 * something *on*, not to throw away what they were wearing, and losing a build as a side effect of
 * equipping another is data loss nobody asked for. Destruction stays where it is explicit.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param equipmentSlotType Which slot
 * @param composedId Which of the character's builds to put in it
 * @returns The character wearing it, or the reason it was refused
 */
export function equipToSlot(
  character: Character,
  config: Configuration,
  equipmentSlotType: string,
  composedId: string
): PlayerActionResult {
  const wrongSlot = slotRefusal(character, config, equipmentSlotType, composedId);
  if (wrongSlot) return { refusal: wrongSlot };

  const { equippedItems, miscItems } = character.inventory;
  const displaced = equippedItems[equipmentSlotType] ?? null;
  // Putting something on takes it out of the pack — see {@link wearingOnly} — and whatever it
  // displaced goes in, so a build is worn or carried and never neither
  const remaining = miscItems.filter((id) => id !== composedId);

  return {
    character: withInventory(character, {
      ...character.inventory,
      equippedItems: wearingOnly(equippedItems, equipmentSlotType, composedId),
      miscItems: displaced === null ? remaining : [...remaining, displaced],
    }),
    before: displaced,
    after: composedId,
  };
}

/**
 * Take whatever is in an equipment slot off, dropping it entirely
 *
 * The counterpart of {@link moveItemToMisc}, which keeps it. Both exist because taking a helmet off
 * and putting it in the pack are different things to do with it.
 *
 * **Dropping now destroys the build as well as emptying the slot** (TICKET-INV-05). The record was a
 * catalog id and is a thing the Player made; a thing that is nowhere is not stored, or the pack and
 * the slots would slowly fill with builds nobody can see and every material they name would be
 * undeletable.
 *
 * @param character Whose sheet
 * @param equipmentSlotType Which slot
 * @returns The character with the slot empty, or the reason it was refused
 */
export function emptySlot(character: Character, equipmentSlotType: string): PlayerActionResult {
  return takeOff(character, equipmentSlotType, (inventory, composedId) => ({
    composedItems: withoutBuild(inventory, composedId),
  }));
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
  return takeOff(character, equipmentSlotType, (inventory, composedId) => ({
    miscItems: [...inventory.miscItems, composedId],
  }));
}

/**
 * Take a template into the pack as a new **build** (v4 systems/12, TICKET-INV-05)
 *
 * **The ruleset has to define the template**, which the browser's store never checked because its
 * own picker is built from the ruleset's item list. A request is not a picker, and a pack holding an
 * id nothing can resolve is a row every surface renders as a blank.
 *
 * ## What changed, and what deliberately did not
 *
 * This used to append a *catalog id* to `miscItems`. It now mints a {@link ComposedItem} and appends
 * **its** id, because that is what the pack holds: two Battleaxes at two tiers are two things a
 * Player wears and drops independently, which a shared catalog id cannot express.
 *
 * The build it mints names **no material and no inlay**, and that is the boundary with
 * TICKET-INV-06 rather than an omission. The three-column picker — template, material tier, inlay
 * tier — with its refusals for an unknown id and an absent rung is that ticket's surface and its
 * action; this is the same *take an item* the app has always had, writing the shape the new model
 * stores it in. `ComposedItem` leaves both links optional precisely so this stays honest: a build
 * with no metal in it is a rope, not a half-written record.
 *
 * **The id is passed in**, for `CharacterIdentity`'s reason: the browser mints its own and the
 * server mints its own, and nothing in `shared/` reaches for a global.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param templateId Which template to build from
 * @param composedId The identity the new build carries, minted by the caller
 * @returns The character carrying it, or the reason it was refused
 */
export function addToPack(
  character: Character,
  config: Configuration,
  templateId: string,
  composedId: string
): PlayerActionResult {
  if (!config.items.some((item) => item.id === templateId)) {
    return { refusal: 'This ruleset has no such item.' };
  }

  const built: ComposedItem = { id: composedId, templateId };

  return {
    character: withInventory(character, {
      ...character.inventory,
      miscItems: [...character.inventory.miscItems, composedId],
      composedItems: [...character.inventory.composedItems, built],
    }),
    before: null,
    after: composedId,
  };
}

/**
 * Take a built item out of the pack, destroying it
 *
 * **One build goes, not every copy**, which is TICKET-INV-05 answering a question v1.0 could not.
 * The pack held catalog ids with no quantities, so two of a thing were two identical entries that
 * nothing could tell apart and a removal took both; a build has its own identity, so removing one
 * removes exactly the one asked for and leaves its twin alone.
 *
 * @param character Whose sheet
 * @param composedId Which build to put down
 * @returns The character without it, or the reason it was refused
 */
export function removeFromPack(character: Character, composedId: string): PlayerActionResult {
  const { inventory } = character;

  if (!inventory.miscItems.includes(composedId)) {
    return { refusal: 'That is not in the pack.' };
  }

  // Filtered by **id**, not by position: a build id is unique by construction, so *the one named* and
  // *every one that matches* are the same set. The first draft found an index and filtered by it,
  // which was the old "remove one copy of a repeated template" story left standing after the thing
  // it worked around had gone — and it read as though a duplicate were possible.
  return {
    character: withInventory(character, {
      ...inventory,
      miscItems: inventory.miscItems.filter((id) => id !== composedId),
      composedItems: withoutBuild(inventory, composedId),
    }),
    before: composedId,
    after: null,
  };
}

/**
 * Move a built item out of the pack and into an equipment slot
 *
 * A slot holds one item, so whatever was in it swaps back into the pack rather than vanishing.
 *
 * ## This and {@link equipToSlot} became the same act, and this is the same code
 *
 * They were genuinely different under the old model: *equip* wrote a catalog id into a slot and
 * never touched the pack, *wear* took an id **out** of the pack and stowed what it displaced. Both
 * halves of that difference were consequences of an id naming a shared template, and neither
 * survives the composed record — `slotRefusal` requires a build the character actually holds, so the
 * thing being put on is always already worn or carried, and the displaced build always has to go
 * somewhere. Fixing the orphan in `equipToSlot` (see its note) made the two bodies identical.
 *
 * So there is **one implementation and two names**, rather than two bodies that would drift. The two
 * names are kept because `PLAYER_ACTION.EQUIP_ITEM` and `WEAR_ITEM` are the *act* vocabulary the
 * routes and the Event log speak — retiring one is a decision about the API surface, and
 * TICKET-INV-06 is where the inventory's surface is being rethought anyway. The argument order
 * differs because the callers' does; that is the whole of what this wrapper is for.
 *
 * @param character Whose sheet
 * @param config The ruleset they play by
 * @param composedId Which build to put on
 * @param equipmentSlotType Where
 * @returns The character wearing it, or the reason it was refused
 */
export function moveItemToEquipment(
  character: Character,
  config: Configuration,
  composedId: string,
  equipmentSlotType: string
): PlayerActionResult {
  return equipToSlot(character, config, equipmentSlotType, composedId);
}
