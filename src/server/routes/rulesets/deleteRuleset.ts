/**
 * `DELETE /api/rulesets/:id` — remove a ruleset, without breaking a running game (TICKET-RUL-01)
 *
 * **The refusal is the interesting half** (v3 Req 33.7). A ruleset a Game_Session was created from
 * is refused with a count and a way forward; the same call with `?confirm=true` deletes it, and
 * every one of those sessions stays playable — `game_session.ruleset_id` is `ON DELETE SET NULL`
 * and the Snapshot is a **copy** taken at creation (D7). What the table loses is the pointer back
 * to where its rules came from, which is provenance rather than rules.
 *
 * Without D7's Snapshot this delete would have to cascade the games away or be refused forever.
 * That is why the confirmation is a real choice rather than a warning with one outcome.
 *
 * **Confirmation is a query parameter, not a body.** A `DELETE` with a body is unevenly supported
 * by intermediaries and by `fetch` itself, and this is one boolean.
 *
 * **Validates: v3 Req 32.2, 32.5, 33.2, 33.7**
 */

import { requireOwner } from '../../auth/guards';
import { conflict } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { countSessionsFromRuleset } from '../../repositories/gameSessionRepository';
import { findRuleset, removeRuleset } from '../../repositories/rulesetRepository';
import { rulesetIdFrom } from './rulesetPayloads';

/** How the Owner says they meant it */
const CONFIRM_PARAMETER = 'confirm';

/**
 * What is standing in the way, as a whole clause
 *
 * The **verb** is in here rather than in the sentence below, and that is the whole point: a helper
 * that returned only the noun phrase produced *"1 game session were started from this ruleset"* for
 * the commonest case there is. This string is rendered to the User verbatim.
 */
function sessionsStartedFrom(total: number): string {
  return total === 1 ? '1 game session was started' : `${total} game sessions were started`;
}

export const deleteRuleset = defineHandler((context): undefined => {
  const rulesetId = rulesetIdFrom(context.url);
  requireOwner(context, findRuleset(rulesetId));

  const confirmed = context.url.searchParams.get(CONFIRM_PARAMETER) === 'true';

  if (!confirmed) {
    const total = countSessionsFromRuleset(rulesetId);

    if (total > 0) {
      throw conflict(
        `${sessionsStartedFrom(total)} from this ruleset. Deleting it leaves them playable on the ` +
          'snapshot each one took, but they will no longer point back at it. Confirm to delete ' +
          'anyway.'
      );
    }
  }

  removeRuleset(rulesetId);

  // Nothing to say — the pipeline turns `undefined` into a 204 rather than a body reading
  // `undefined`, which is the case SRV-01 wrote that branch for
  return undefined;
});
