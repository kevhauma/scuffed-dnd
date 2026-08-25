/**
 * Every query that touches a `session_member` row (TICKET-AUTH-03)
 *
 * **Named for the session rather than for the membership**, because they are one aggregate: a
 * session without its membership rows is not a table anybody can sit at, D7's Snapshot is pinned to
 * the session, and the queries GAM-01 adds here will join the two. Splitting them would be
 * splitting a thing, not a layer.
 *
 * **One read, because the guards need exactly one.** A `findGameSession` and a `hasSessionRole`
 * were drafted beside it and deleted: nothing called either, and an exported function with no
 * caller is a claim that something uses it. TICKET-GAM-01 through GAM-04 bring create,
 * join, remove, leave and transfer-DM against their own routes and their own authorization tests;
 * writing them now would be writing them blind. This exists early for the reason AUTH-03 exists
 * early — a guard has to be callable before the first resource it protects is built.
 *
 * ## The connection is optional, and that is the shape every later repository should copy
 *
 * `db/client.ts` says it plainly: *"a route does not take a database — it calls something in `db/`
 * or a repository, and those reach `getDatabase()`"*. So the parameter is **last and defaulted**,
 * which is what makes a function here callable from a handler that has no connection in hand, while
 * a test that wants an explicit one still passes it.
 *
 * DB-01's `rulesetRepository` and `eventRepository` predate this and still take the connection
 * first. They are not rewritten here — no handler calls them yet, and their argument order is worth
 * more attached to TICKET-RUL-01, which adds the handler-facing functions that need it.
 *
 * **Validates: v3 Req 32.3, 32.4**
 */

import { and, count, eq } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { gameSession, sessionMember } from '../db/schema';

/** Somebody's seat at a table, and the role they hold in it */
export type SessionMemberRow = typeof sessionMember.$inferSelect;

/**
 * One Account's membership of one session
 *
 * **The whole of "may they touch this session?"**, in one query rather than a session read followed
 * by a membership read. A non-member and a session that does not exist both come back `null`, which
 * is not laziness — it is v3 Req 32.5 arriving at the layer below the guard, so that the guard has
 * nothing to leak even if it wanted to.
 *
 * @param sessionId Which session
 * @param accountId Which Account
 * @param database The connection; defaults to the process's
 * @returns The membership row, or `null` for a non-member *and* for a session that is not there
 */
export function findSessionMember(
  sessionId: string,
  accountId: string,
  database: Database = getDatabase()
): SessionMemberRow | null {
  return (
    database.db
      .select()
      .from(sessionMember)
      .where(and(eq(sessionMember.sessionId, sessionId), eq(sessionMember.accountId, accountId)))
      .get() ?? null
  );
}

/**
 * How many games are being played from one ruleset (TICKET-RUL-01, v3 Req 33.7)
 *
 * The whole of "refuse to delete a Ruleset that a Game_Session was created from". **A count rather
 * than the rows**, because the route needs a number to put in a sentence — *three sessions were
 * started from this ruleset* — and nothing about which ones; loading them would be loading three
 * pinned Snapshots to ask a yes/no question.
 *
 * @param rulesetId Which ruleset
 * @param database The connection; defaults to the process's
 * @returns How many sessions still point at it
 */
export function countSessionsFromRuleset(
  rulesetId: string,
  database: Database = getDatabase()
): number {
  return (
    database.db
      .select({ total: count() })
      .from(gameSession)
      .where(eq(gameSession.rulesetId, rulesetId))
      .get()?.total ?? 0
  );
}
