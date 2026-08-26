/**
 * Every query that touches a `session_invite` row (TICKET-GAM-02)
 *
 * **One live code per session, not one row per invitee.** The ticket is explicit about it: the code
 * lives on the session, which is why revoke-and-reissue is the only revocation there is. Per-person
 * revocation is GAM-03's addressed invite or GAM-04's remove-member, and growing a third mechanism
 * here is the thing the note warns against.
 *
 * So a GAM-02 row has `email IS NULL` and never sets `redeemed_at` — many Accounts redeem one code,
 * and stamping it with whoever got there first would end the invitation for everybody else. Those
 * two columns belong to GAM-03's variant, where an invite really is addressed to one person and
 * really is used up.
 *
 * **Validates: v3 Req 38.1, 38.2, 38.7**
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { sessionInvite } from '../db/schema';

/** An invite row as the server holds it */
export type SessionInviteRow = typeof sessionInvite.$inferSelect;

/** What issuing a code needs to be told */
export interface NewSessionInvite {
  id: string;
  sessionId: string;
  /** The **normalised** code — comparison is between two normal forms, never one and a raw string */
  code: string;
  expiresAt: number;
  /** Epoch milliseconds */
  now: number;
}

/**
 * Take back every live code for a session
 *
 * @param sessionId Which session
 * @param now Epoch milliseconds — stamped as when it was taken back
 * @param database The connection; defaults to the process's
 * @returns How many were revoked; `0` when there was nothing live
 */
export function revokeSessionInvites(
  sessionId: string,
  now: number,
  database: Database = getDatabase()
): number {
  return revokeThrough(database.db, sessionId, now);
}

/**
 * The revoke statement, against whichever handle it is given
 *
 * **Split out so {@link issueSessionInvite} can run it on its transaction handle** rather than on
 * the outer connection. It worked either way on `better-sqlite3` — same synchronous connection — and
 * *"correct because the driver happens to be synchronous"* is the kind of correctness that stops
 * being true without anybody noticing. `insertGameSession` is the house pattern and uses `tx`
 * throughout; this was the one transaction in the tree that did not.
 *
 * @param handle The connection or the transaction to run on
 * @param sessionId Which session
 * @param now Epoch milliseconds
 * @returns How many rows were revoked
 */
function revokeThrough(handle: Database['db'], sessionId: string, now: number): number {
  return handle
    .update(sessionInvite)
    .set({ revokedAt: now })
    .where(and(eq(sessionInvite.sessionId, sessionId), isNull(sessionInvite.revokedAt)))
    .returning()
    .all().length;
}

/**
 * Issue a code, taking back whatever the session had (v3 Req 38.2)
 *
 * **One transaction, because reissuing is one act.** The criterion is that the previous code stops
 * working — so a revoke that landed without its replacement would leave a table with no way in, and
 * an insert that landed without its revoke would leave *two* live codes, which is the failure the
 * DM was trying to prevent by reissuing.
 *
 * @param input The new code
 * @param database The connection; defaults to the process's
 * @returns The stored row
 */
export function issueSessionInvite(
  input: NewSessionInvite,
  database: Database = getDatabase()
): SessionInviteRow {
  return database.db.transaction((tx) => {
    // Through `tx`, not the outer connection — see {@link revokeThrough}
    revokeThrough(tx, input.sessionId, input.now);

    return tx
      .insert(sessionInvite)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        code: input.code,
        email: null,
        expiresAt: input.expiresAt,
        createdAt: input.now,
      })
      .returning()
      .get();
  });
}

/**
 * The invite a code names, whatever state it is in
 *
 * **Revoked and expired rows come back too**, deliberately: v3 Req 38.4 asks for a *distinct message
 * for each*, and a query that filtered them out would leave the route unable to tell *taken back*
 * from *never existed*. Judging the row is the route's job; finding it is this one's.
 *
 * @param code The **normalised** code
 * @param database The connection; defaults to the process's
 * @returns The row, or `null` when no invite carries that code
 */
export function findInviteByCode(
  code: string,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return database.db.select().from(sessionInvite).where(eq(sessionInvite.code, code)).get() ?? null;
}

/**
 * The code a session is currently handing out, if it has one
 *
 * Newest first and revoked rows excluded, because a session accumulates one row per reissue and only
 * the last of them is the answer. Whether it has **expired** is left to the caller for
 * {@link findInviteByCode}'s reason — a DM looking at a stale code should be told it is stale rather
 * than shown nothing.
 *
 * @param sessionId Which session
 * @param database The connection; defaults to the process's
 * @returns The live row, or `null` when the session has never issued one or has revoked them all
 */
export function activeInviteForSession(
  sessionId: string,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return (
    database.db
      .select()
      .from(sessionInvite)
      .where(and(eq(sessionInvite.sessionId, sessionId), isNull(sessionInvite.revokedAt)))
      .orderBy(desc(sessionInvite.createdAt))
      .get() ?? null
  );
}
