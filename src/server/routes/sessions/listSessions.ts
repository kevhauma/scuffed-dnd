/**
 * `GET /api/sessions` — every table this Account sits at (TICKET-GAM-01)
 *
 * **Scoped by the caller, so there is no id to guard.** `requireAccount` is the right and sufficient
 * guard for a route that names no resource — `listRulesets` is the precedent — and the scoping is
 * the repository's `WHERE session_member.account_id = ?` rather than a filter applied after a
 * broader read.
 *
 * **No Snapshot crosses the wire here.** The listing selects every column but that one, which is
 * `listRulesets`'s rule one aggregate over and matters more here: a Snapshot is what the table
 * *plays against*, so a client holding one from a list could compute against rules it never asked
 * the server to confirm.
 *
 * **Validates: v3 Req 32.1, 37**
 */

import type { GameSessionListing } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { listSessionsForAccount } from '../../repositories/gameSessionRepository';
import { toSessionSummary } from './sessionPayloads';

export const listSessions = defineHandler((context): GameSessionListing => {
  const account = requireAccount(context);

  return {
    sessions: listSessionsForAccount(account.id).map((row) => toSessionSummary(row, row.role)),
  };
});
