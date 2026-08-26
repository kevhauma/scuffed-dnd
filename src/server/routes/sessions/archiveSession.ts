/**
 * `POST /api/sessions/:id/archive` — close a table without deleting it (TICKET-GAM-01)
 *
 * **Archiving is a status, and everything stays.** The Snapshot, the characters and the Event log
 * are all readable afterwards; what changes is that every write route refuses. A campaign that ended
 * is not a campaign that never happened, and the alternative — deleting the session — takes the
 * characters with it through the cascade.
 *
 * **The DM's, not every Member's** (v3 Req 37.5, 32.3). A player closing the table would be a player
 * ending everybody else's game.
 *
 * **Archiving twice is refused rather than ignored**, through the same `requireActive` every other
 * write uses. That is a deliberate consequence of putting the check in one place: an idempotent
 * archive would need this route to opt out of the rule, and *"which writes does an archived session
 * accept?"* is a question worth having exactly one answer to.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5**
 */

import type { GameSessionSummary } from '#shared/types/api';
import { requireDM } from '../../auth/guards';
import { notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { archiveGameSession, findGameSession } from '../../repositories/gameSessionRepository';
import { requireActive, sessionIdFrom, toSessionSummary } from './sessionPayloads';

export const archiveSession = defineHandler((context): GameSessionSummary => {
  const sessionId = sessionIdFrom(context.url);
  const membership = requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  const archived = archiveGameSession(sessionId, Date.now());
  if (!archived) throw notFound();

  return toSessionSummary(archived, membership.role);
});
