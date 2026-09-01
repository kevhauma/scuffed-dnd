/**
 * How each entity an adjustment can name is spelled on this ruleset (TICKET-PAS-01)
 *
 * [`describeAdjustment`](./describeAdjustment.ts)'s other half, and it lives beside it for that
 * reason: one builds the sentence and one supplies the words, and a reader asking *why is this one
 * map* should find the answer in the same folder as the function that consumes it.
 *
 * ## One map across both kinds, not one per kind
 *
 * An adjustment names an entity in two of its forms — `dm-set-resource` names a **stat**, and
 * `dm-grant-passive` / `dm-revoke-passive` name a **passive**. Every id in this app is a UUID, so a
 * single lookup cannot confuse the two; a second parameter would exist only because two panels
 * minted the ids, which is a fact about this codebase's history rather than about the log.
 *
 * ## Where each half comes from, and why they differ
 *
 * The **stats** come from the list the sheet's own sections render, so an adjustment and the row it
 * moved cannot disagree about what the stat is called. The **passives** come from the ruleset's
 * *catalog* rather than from what the character currently holds — an ability revoked five minutes
 * ago is gone from the character and still has a row in the log, and *"Took back the passive
 * 9f3c…"* would be the one sentence there that could not be read.
 *
 * A pure mapper in its own module, `pointBudgetView.ts`'s and `derivedValue.ts`'s shape: it is the
 * part worth testing directly, and a hook that assembled it inline was measured over the complexity
 * threshold for doing so.
 *
 * **Validates: v3 Req 42.6, 42.7; v4 systems/14**
 */

import type { Configuration } from '#shared/types/config';

/** What this mapper needs of a stat — the sheet's own rows carry more */
interface NamedEntity {
  id: string;
  name: string;
}

/** One id → display-spelling entry per entity */
function spellingsOf(entities: readonly NamedEntity[]): Record<string, string> {
  const entries = entities.map((entity) => [entity.id, entity.name]);

  return Object.fromEntries(entries);
}

/**
 * Build the lookup the adjustment log reads
 *
 * @param config The ruleset this sheet is read against, or `null` before one is loaded
 * @param stats The stat rows the sheet is rendering, in its own order
 * @returns Every id an adjustment can name, mapped to how this ruleset spells it
 */
export function adjustmentNamesFrom(
  config: Configuration | null,
  stats: readonly NamedEntity[]
): Record<string, string> {
  const passives = spellingsOf(config?.passives ?? []);
  const statNames = spellingsOf(stats);

  return { ...passives, ...statNames };
}
