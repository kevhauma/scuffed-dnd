/**
 * `POST /api/sessions/:id/snapshot` — pull the ruleset's current state into a running game
 * (TICKET-GAM-01)
 *
 * **The one deliberate act D7 allows.** Every other path leaves a session's rules alone; this is the
 * DM saying *yes, I want Thursday's changes at Friday's table* — and it is refused when that would
 * leave somebody at the table holding an allocation the new rules cannot honour (v3 Req 37.6).
 *
 * **Refused, with names.** A generic *"some characters would be invalid"* is a refusal a DM cannot
 * act on: they cannot tell whether to fix the ruleset, fix a character, or leave the table alone.
 * Every conflict rides back on the 409 — see
 * [`snapshotConflicts`](./snapshotConflicts.ts) for why the notion of validity is the Kernel's.
 *
 * **Owning the ruleset is required, not merely running the table.** GAM-04 can transfer the DM role,
 * so the two can come apart — and a DM who does not own the ruleset pulling its current state would
 * be reaching into somebody else's document. They get the ordinary 404.
 *
 * **The refresh is an Event** (v3 Req 37.3). It is the first thing this milestone writes to the log,
 * and it is the right first thing: LIVE-02 fans these out, and *the rules just changed under you* is
 * the event a player most needs to be told about without asking.
 *
 * **Validates: v3 Req 32.1, 32.2, 32.3, 32.5, 37.3, 37.5, 37.6**
 */

import { copyConfiguration } from '#shared/services/copyConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import type { GameSessionDocument } from '#shared/types/api';
import { requireDM, requireOwner } from '../../auth/guards';
import { conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import {
  charactersInSession,
  findGameSession,
  refreshSessionSnapshot,
} from '../../repositories/gameSessionRepository';
import { findRuleset } from '../../repositories/rulesetRepository';
import { displayDocumentOf } from '../rulesets/rulesetPayloads';
import { requireActive, sessionIdFrom, snapshotOf, toSessionSummary } from './sessionPayloads';
import { snapshotConflicts } from './snapshotConflicts';

/** What the log calls this, so LIVE-02 has a name to fan out rather than a literal to guess */
const SESSION_EVENT = {
  SNAPSHOT_REFRESHED: 'session.snapshot_refreshed',
} as const;

export const refreshSnapshot = defineHandler((context): GameSessionDocument => {
  const sessionId = sessionIdFrom(context.url);
  const membership = requireDM(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  // A session outlives the ruleset it came from — `ruleset_id` is `ON DELETE SET NULL` and the game
  // keeps playing on its Snapshot (D7). There is simply nothing left to refresh *from*, which is a
  // fact about the resource's state rather than a mistake in the request.
  if (row.rulesetId === null) {
    throw conflict(
      'The ruleset this session was created from has been deleted, so there is nothing to refresh ' +
        'from. The session keeps playing by the rules it already has.'
    );
  }

  const source = requireOwner(context, findRuleset(row.rulesetId));

  const current = snapshotOf(row);
  const document = displayDocumentOf(source);

  // **The Snapshot keeps the identity it already had**, which is the one thing a refresh must not
  // change. A character says which rules it was built against with `configurationId`, and
  // `useCharacterSheet` renders *configuration-mismatch* when that disagrees with the loaded
  // document — so a refresh that minted a fresh id would blank every sheet at the table while
  // `snapshotConflicts` reported everything fine. It cannot see this: `validateStatAllocation` is
  // about allocations, and the document's own id is not one.
  //
  // The name is passed through for the reason `createSession` gives — a Snapshot is not a copy in
  // anybody's list and must not be renamed like one.
  const candidate = copyConfiguration(document, { name: document.name, id: current.id });

  const conflicts = snapshotConflicts(charactersInSession(sessionId), current, candidate);

  if (conflicts.length > 0) {
    throw conflict(
      'Refreshing the rules would leave characters at this table invalid, so nothing was changed. ' +
        'Fix what is listed below, or leave the session on the rules it has.',
      { conflicts }
    );
  }

  const now = Date.now();

  // The pin and the log entry are **one write** — see `refreshSessionSnapshot` for why a refresh
  // nobody was told about is the worse half to lose
  const refreshed = refreshSessionSnapshot({
    sessionId,
    snapshot: serializeConfiguration(candidate),
    schemaVersion: candidate.schemaVersion,
    actorAccountId: membership.accountId,
    eventId: crypto.randomUUID(),
    type: SESSION_EVENT.SNAPSHOT_REFRESHED,
    // The ruleset it came from and when, rather than the document — an Event log carrying a copy of
    // every Snapshot ever pinned would grow by tens of kilobytes per refresh to say one thing
    payload: JSON.stringify({ rulesetId: source.id, snapshotTakenAt: now }),
    now,
  });

  if (!refreshed) throw notFound();

  return { ...toSessionSummary(refreshed, membership.role), snapshot: snapshotOf(refreshed) };
});
