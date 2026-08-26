/**
 * `POST /api/sessions` — start a table from a ruleset you own (TICKET-GAM-01)
 *
 * **The Snapshot is taken here, and that is the whole of D7.** Creating a session *copies* the
 * Ruleset into it; the table then plays against that copy forever, or until a DM deliberately
 * refreshes it. A DM renaming a stat on Thursday does not re-price every character at Friday's game,
 * because Friday's game is not reading Thursday's ruleset — it is reading a document that stopped
 * changing when the session began.
 *
 * **The copy goes through the Kernel's `copyConfiguration`**, which is
 * [its docblock's own prediction](../../../shared/services/copyConfiguration.ts): *"GAM-01's Snapshot
 * is the same operation with a different destination and must not reach for its own."* What that
 * buys is the property RUL-03 proved structurally — the copy shares **no object** with the source —
 * so a later edit to the ruleset cannot reach into a running game through a shared array.
 *
 * **`ruleset_id` is provenance, not rules.** It records where the table came from and is
 * `ON DELETE SET NULL`, so deleting the ruleset leaves the game playable on its Snapshot.
 *
 * **Validates: v3 Req 32.1, 32.2, 32.5, 37.1, 37.2, 37.4**
 */

import { copyConfiguration } from '#shared/services/copyConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import type { GameSessionCreateRequest, GameSessionSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { requireAccount, requireOwner } from '../../auth/guards';
import { badRequest } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { insertGameSession } from '../../repositories/gameSessionRepository';
import { findRuleset } from '../../repositories/rulesetRepository';
import { requiredName } from '../entityName';
import { displayDocumentOf } from '../rulesets/rulesetPayloads';
import { SESSION_SUBJECT, toSessionSummary } from './sessionPayloads';

/** Which ruleset a request asked to play, or a refusal */
function rulesetIdFrom(body: GameSessionCreateRequest): string {
  if (typeof body?.rulesetId !== 'string' || body.rulesetId === '') {
    throw badRequest('A game session is started from a ruleset, so it needs one named.');
  }

  return body.rulesetId;
}

export const createSession = defineHandler(async (context): Promise<GameSessionSummary> => {
  // **Before the body is read**, so an anonymous caller meets a 401 rather than a 400 about their
  // JSON. `requireOwner` below re-checks it — the guards all begin with `requireAccount` — and this
  // is what makes *sign in and come back* the answer to a request that had no body at all.
  requireAccount(context);

  const body = await context.json<GameSessionCreateRequest>();
  const rulesetId = rulesetIdFrom(body);

  // **Owning the ruleset is what earns the right to start a table from it** (v3 Req 32.2). A
  // stranger and a ruleset that never existed get the same 404, so this refusal says nothing about
  // whose ruleset it is or whether it is there.
  const source = requireOwner(context, findRuleset(rulesetId));
  const name = requiredName(body, SESSION_SUBJECT);

  const document = displayDocumentOf(source);

  // Copied from the **display** form, then serialised back down — the same round trip
  // `copyRuleset` takes, and for the same reason: the Snapshot is a document in the shape any
  // client would have sent, rather than a duplicate of the stored text that skips the boundary.
  //
  // **The name is passed through rather than derived**, which is the one place this differs from
  // `copyRuleset`. That route makes a *derivative* — "Ducklets (copy)" — because the User will see
  // two rulesets in a list and has to tell them apart. A Snapshot is not a second ruleset in
  // anybody's list: it is this ruleset, as it stood, and the thing the table is named after is the
  // session's own `name`. Renaming it would make the rules a player reads disagree with the rules
  // the DM wrote. Passing it is what stops `copyConfiguration`'s default appending "(copy)".
  const snapshot = copyConfiguration(document, { name: document.name });

  const session = insertGameSession({
    id: crypto.randomUUID(),
    rulesetId: source.id,
    dmAccountId: source.ownerAccountId,
    name,
    snapshot: serializeConfiguration(snapshot),
    snapshotSchemaVersion: snapshot.schemaVersion,
    now: Date.now(),
    memberId: crypto.randomUUID(),
  });

  // The creator is the DM by definition here — they are the ruleset's Owner, which is what the
  // guard above just established
  return toSessionSummary(session, MEMBER_ROLE.DM);
});
