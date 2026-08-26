/**
 * `GET /api/sessions/:id` — the table, and the rules it plays by (TICKET-GAM-01)
 *
 * **This is the only way a session's rules are obtained, and it returns the Snapshot** (v3 Req 37.2).
 * D7 is not a comment here: `snapshotOf` reads the pinned column, and nothing in `src/server/` loads
 * a Ruleset by a session's `ruleset_id` in order to evaluate anything. The `rulesetId` that rides
 * along on the summary is provenance — *this table came from that ruleset* — and it is `null` once
 * that ruleset is deleted, which changes nothing about the game.
 *
 * **Every Member reads it, including an archived one** (v3 Req 37.5). Archiving refuses writes; a
 * table nobody can read afterwards would be a delete wearing a gentler word.
 *
 * ## Why this is `readSession` and not `getSession`
 *
 * `getRuleset` is the name the sibling folder uses, and this would be `getSession` by that rule. It
 * is not, because `pipeline.test.ts` scans every module under `src/server/` for the word
 * `getSession` and asserts that exactly one names it: `auth/currentAccount.ts`, which is the only
 * place a request may become an Account. That guard is deliberately blunt — its whole value is that
 * it cannot be talked round — and a route called `getSession` would have cost the milestone's
 * identity check to save a synonym. Renaming was the cheaper side of that trade by a distance.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.2, 37.5**
 */

import type { GameSessionDocument } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { findGameSession } from '../../repositories/gameSessionRepository';
import { sessionIdFrom, snapshotOf, toSessionSummary } from './sessionPayloads';

export const readSession = defineHandler((context): GameSessionDocument => {
  const sessionId = sessionIdFrom(context.url);
  // The membership *is* the authorization, and it comes back carrying the role — so the response
  // can say what this caller is at this table without a second query
  const membership = requireMember(context, sessionId);

  const row = findGameSession(sessionId);

  // A membership whose session has gone is a row that should not exist. It is the same 404 a
  // non-member gets rather than a 500, because from the caller's side the two are one fact.
  if (!row) throw notFound();

  return { ...toSessionSummary(row, membership.role), snapshot: snapshotOf(row) };
});
