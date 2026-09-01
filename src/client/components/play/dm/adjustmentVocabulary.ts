/**
 * The words the adjustment log reads an Event in (TICKET-PAS-01, widened by TICKET-DM-02)
 *
 * [`describeAdjustment`](./describeAdjustment.ts)'s other half, and it lives beside it for that
 * reason: one builds the sentence and one supplies the words, and a reader asking *why is this one
 * lookup* should find the answer in the same folder as the function that consumes it.
 *
 * ## One vocabulary across every kind, not one per kind
 *
 * An adjustment names an entity in four forms — `dm-set-resource` names a **stat**,
 * `dm-grant-passive` / `dm-revoke-passive` name a **passive**, `dm-build-item` names an item
 * **template**, and `dm-equip-item` / `dm-unequip-item` name an equipment **slot type**. One map
 * serves all four; a parameter per kind would exist only because four panels minted the keys, which
 * is a fact about this codebase's history rather than about the log.
 *
 * **The keys are not all UUIDs, and TICKET-DM-02 is when that stopped being true.** It was, while
 * every key was an entity id; an `EquipmentSlot.type` is a slug the User writes (`helmet`,
 * `main_hand`), so the claim is now *the four key spaces do not collide* rather than *they are all
 * UUIDs* — which holds, because nothing in a ruleset can mint a slug that is also a UUID.
 *
 * ## Money is a phrase, not a name, and it is still this module's job
 *
 * `dm-set-purse` and `dm-adjust-purse` carry **amounts** rather than ids, and an amount has to be
 * spelled the way the rest of the app spells one: `formatPurse` decides the tier every render (v3 Req
 * 43.2, CLAUDE.md's derived-values rule), so a log saying *"30 → 42"* beside a card saying *"4 gold 2
 * silver"* would be the app disagreeing with itself about what somebody is carrying. That is the same
 * job this module already does for an id — turn what the Event stored into what a reader should see —
 * so it belongs here rather than as a parameter threaded through `describeAdjustment` and
 * `AdjustmentLog`.
 *
 * ## Where each part comes from, and why they differ
 *
 * The **stats** come from the list the sheet's own sections render, so an adjustment and the row it
 * moved cannot disagree about what the stat is called. The **passives**, **items** and **slots** come
 * from the ruleset's *catalog* rather than from what the character currently holds — an ability
 * revoked five minutes ago is gone from the character and still has a row in the log, and *"Took back
 * the passive 9f3c…"* would be the one sentence there that could not be read.
 *
 * A pure mapper in its own module, `pointBudgetView.ts`'s and `derivedValue.ts`'s shape: it is the
 * part worth testing directly, and a hook that assembled it inline was measured over the complexity
 * threshold for doing so.
 *
 * **Validates: v3 Req 42.5, 42.6, 42.7, 43.2; v4 systems/14**
 */

import { formatPurse } from '#shared/engine/currency';
import type { Configuration } from '#shared/types/config';

/** What this mapper needs of a stat — the sheet's own rows carry more */
interface NamedEntity {
  id: string;
  name: string;
}

/** What an equipment slot is keyed by, which is its `type` rather than an id */
interface TypedEntity {
  type: string;
  name: string;
}

/**
 * Everything the log needs in order to read an Event out loud
 *
 * Two members rather than a bare `Record`, because the two questions differ in kind: *what is this id
 * called* is a lookup, and *what is this amount of money* is a computation over the ruleset's
 * conversion rates. Both are *turn what was stored into what a reader sees*, which is why they are
 * one object and one parameter.
 */
export interface AdjustmentVocabulary {
  /** How each entity an adjustment can name is spelled on this ruleset */
  names: Record<string, string>;
  /** An amount in the base tier, in the tier it reads most naturally in */
  money: (amount: number) => string;
}

/** One id → display-spelling entry per entity */
function spellingsOf(entities: readonly NamedEntity[]): Record<string, string> {
  const entries = entities.map((entity) => [entity.id, entity.name]);

  return Object.fromEntries(entries);
}

/** The same, for the one collection keyed by a `type` instead */
function slotSpellingsOf(slots: readonly TypedEntity[]): Record<string, string> {
  const entries = slots.map((slot) => [slot.type, slot.name]);

  return Object.fromEntries(entries);
}

/**
 * Build the vocabulary the adjustment log reads
 *
 * @param config The ruleset this sheet is read against, or `null` before one is loaded
 * @param stats The stat rows the sheet is rendering, in its own order
 * @returns Every spelling an adjustment can need, and how this ruleset says an amount of money
 */
export function adjustmentVocabularyFrom(
  config: Configuration | null,
  stats: readonly NamedEntity[]
): AdjustmentVocabulary {
  const passives = spellingsOf(config?.passives ?? []);
  const items = spellingsOf(config?.items ?? []);
  const slots = slotSpellingsOf(config?.equipmentSlots ?? []);
  const statNames = spellingsOf(stats);
  const tiers = config?.currencyTiers ?? [];

  return {
    names: { ...passives, ...items, ...slots, ...statNames },
    // A ruleset with no tiers formats a bare number, which is `formatPurse`'s own answer rather than
    // a fallback invented here — a ruleset may define no currency, as it may define no races
    money: (amount: number) => formatPurse(amount, tiers),
  };
}
