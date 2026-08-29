/**
 * One DM adjustment, in a sentence (TICKET-DM-01)
 *
 * A pure mapper, kept out of the component that renders it for
 * [`pointBudgetView.ts`](../shared/pointBudgetView.ts)'s reason: it is the part worth testing
 * directly, and a component test would have to render a card to assert a string.
 *
 * **The Event is the record and this is a reading of it.** Every sentence is built from `before` and
 * `after` — the two numbers `applyPlayerAction` writes on every accepted action (v3 Req 42.6) — so
 * the log can say *what changed* without re-reading the character, and a sheet edited five times
 * since still describes each step correctly.
 *
 * **A `dm-set-level` reads as experience, not as a level**, which is the one place this could have
 * lied. The DM typed a level and the server wrote what the ruleset prices it at
 * ([D9](../../../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant));
 * the level the Player is now at is derived from that total by the sheet beside this panel, and
 * printing a stored one here would be the app's only claim that a level is a thing you can write.
 *
 * **Validates: v3 Req 42.2, 42.6, 42.7**
 */

import { type CharacterAdjustment, DM_ACTION } from '#shared/types/api';

/** A before/after value as a number, or 0 for the shapes an adjustment never carries */
function amount(value: CharacterAdjustment['before']): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * What one adjustment did, as a line a Player can read
 *
 * @param adjustment The Event, as the server projected it
 * @param statNames How each stat id is spelled on the ruleset this sheet is read against
 * @returns The sentence
 */
export function describeAdjustment(
  adjustment: CharacterAdjustment,
  statNames: Record<string, string>
): string {
  const before = amount(adjustment.before);
  const after = amount(adjustment.after);

  switch (adjustment.action) {
    case DM_ACTION.AWARD_EXPERIENCE:
      return `Awarded ${after - before} experience — ${before} → ${after}`;

    case DM_ACTION.DEDUCT_EXPERIENCE:
      return `Deducted ${before - after} experience — ${before} → ${after}`;

    case DM_ACTION.SET_LEVEL:
      // The level is not in the payload and is not stored anywhere; what happened was a write to
      // experience, and that is what this says
      return `Set the level, putting experience at ${after} — was ${before}`;

    case DM_ACTION.GRANT_POINTS:
      return after >= before
        ? `Granted stat points — ${before} → ${after}`
        : `Revoked stat points — ${before} → ${after}`;

    case DM_ACTION.SET_DREAM_LEVEL:
      // Unlike `dm-set-level` above, the number in the payload *is* what was stored — dream level is
      // player state nothing derives (TICKET-RES-04)
      return `Set the dream level — ${before} → ${after}`;

    case DM_ACTION.SET_RESOURCE:
      // The **ruleset's** spelling, falling back to the id: a stat deleted from the Snapshot since
      // still has a row in the log, and *"set stat 9f3c…"* is at least a true one
      return `Set ${statNames[adjustment.target] ?? adjustment.target} to ${after} — was ${before}`;

    default: {
      // The wire says `DmAction`, so a value not handled above is a seventh action somebody added
      // without a sentence for it — a bug in this file, not a ruleset problem
      const _exhaustive: never = adjustment.action;
      return `Adjusted the sheet (${String(_exhaustive)})`;
    }
  }
}
