/**
 * Every query that touches a `session_invite` row (TICKET-GAM-02, TICKET-GAM-03)
 *
 * **Two kinds of row live in this table, and every query below says which it means.** A GAM-02 row
 * is the session's *shared door*: `code` is set, `email` is `NULL`, and it is never stamped
 * `redeemed_at`, because many Accounts redeem one code and marking it with whoever got there first
 * would end the invitation for everybody else. A GAM-03 row is a *letter to one address*: `email` is
 * set, `code` is `NULL` so there is no second way in, and it really is used up.
 *
 * **`email IS NULL` is load-bearing in exactly two places** — {@link activeInviteForSession} and
 * `revokeThrough`. Reissuing the shared code must not silently take back four addressed
 * invitations, and the DM's code panel must not show somebody's private letter; both are one
 * `isNull(email)` away from being wrong, which is why they are stated rather than implied.
 * {@link findInviteByCode} carries **no** such predicate and needs none: an addressed row has
 * `code IS NULL`, and `= ?` never matches `NULL`. Restoring a "missing" `isNull(email)` there would
 * be adding a clause nothing needs.
 *
 * **Revoked, declined, redeemed and expired are four states, not a flag.** v3 Req 38.4 asks for a
 * distinct message for each; the columns hold *when*, and `routes/invitations/invitationPayloads.ts`
 * derives the word. Nothing here stores the state, because a stored copy is the one that goes stale.
 *
 * **Validates: v3 Req 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7**
 */

import { and, asc, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { authUser, gameSession, sessionInvite } from '../db/schema';

/** An invite row as the server holds it, of either kind */
export type SessionInviteRow = typeof sessionInvite.$inferSelect;

/**
 * A row that really is the session's shared door (TICKET-GAM-03)
 *
 * `code` became nullable when addressed invitations arrived, and the two callers that hand a code to
 * a DM would otherwise each need a `?? ''` for a case that cannot happen. The type says it cannot
 * instead — and {@link asSharedInvite} is where the claim is *checked* rather than asserted, so a
 * query that one day forgot its `email IS NULL` produces nothing rather than a row with no code in
 * a field typed as having one.
 */
export type SharedInviteRow = SessionInviteRow & { code: string };

/**
 * A row as a shared-code one, if that is what it is
 *
 * @param row The stored invitation, or nothing
 * @returns The same row, now known to carry a code; `null` for an addressed row or no row at all
 */
function asSharedInvite(row: SessionInviteRow | undefined | null): SharedInviteRow | null {
  return row && row.code !== null ? { ...row, code: row.code } : null;
}

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
 * Take back every live **shared code** for a session
 *
 * Addressed invitations are untouched, which is GAM-03's fifth criterion: a DM reissuing the code
 * their group chat has is not withdrawing the four letters they sent last week.
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
    .where(
      and(
        eq(sessionInvite.sessionId, sessionId),
        // The shared door only — an addressed row is somebody's letter and is revoked by id
        isNull(sessionInvite.email),
        isNull(sessionInvite.revokedAt)
      )
    )
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
): SharedInviteRow {
  const stored = database.db.transaction((tx) => {
    // Through `tx`, not the outer connection — see {@link revokeThrough}
    revokeThrough(tx, input.sessionId, input.now);

    return tx
      .insert(sessionInvite)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        code: input.code,
        // The shared door: a code and **no** address, which is what distinguishes it from
        // `insertAddressedInvite`'s row in every query below
        email: null,
        expiresAt: input.expiresAt,
        createdAt: input.now,
      })
      .returning()
      .get();
  });

  // The code this call just wrote, rather than a cast over the row that came back — the narrowing
  // is then a fact about this function rather than an assertion about the column
  return { ...stored, code: input.code };
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
): SharedInviteRow | null {
  return asSharedInvite(
    database.db
      .select()
      .from(sessionInvite)
      .where(
        and(
          eq(sessionInvite.sessionId, sessionId),
          // …the **shared** one. An addressed invitation is not the code a DM reads aloud, and
          // showing one here would put somebody's private letter on the table's invite panel.
          isNull(sessionInvite.email),
          isNull(sessionInvite.revokedAt)
        )
      )
      .orderBy(desc(sessionInvite.createdAt))
      .get()
  );
}

/**
 * What a `session_invite` row needs to be a letter to one address (TICKET-GAM-03)
 *
 * **No `code`, and that is the shape of the decision rather than an omission** — see the column's
 * own note in `db/schema.ts`. An addressed invitation is taken up from the invitee's pending list,
 * by the Account whose address it names; a code on it would be a second, secret door.
 */
export interface NewAddressedInvite {
  id: string;
  sessionId: string;
  /** The **normalised** address — comparison is between two normal forms, never one and a keyboard */
  email: string;
  expiresAt: number;
  /** Epoch milliseconds */
  now: number;
}

/**
 * Send one (v3 Req 38.3)
 *
 * **Nothing is revoked here**, which is the whole difference from {@link issueSessionInvite}. A
 * second letter to a second address is a second row; a second letter to the *same* address is
 * refused by the route, which finds the pending one with {@link pendingInviteFor} and hands that
 * back rather than minting a duplicate (GAM-03's sixth criterion).
 *
 * @param input The invitation
 * @param database The connection; defaults to the process's
 * @returns The stored row
 */
export function insertAddressedInvite(
  input: NewAddressedInvite,
  database: Database = getDatabase()
): SessionInviteRow {
  return database.db
    .insert(sessionInvite)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      code: null,
      email: input.email,
      expiresAt: input.expiresAt,
      createdAt: input.now,
    })
    .returning()
    .get();
}

/**
 * The invitation with this id, whatever state it is in
 *
 * {@link findInviteByCode}'s reasoning, by the other identifier: judging the row is the caller's
 * job — the guard's, here — and a query that filtered out the revoked ones would leave it unable to
 * tell *taken back* from *never existed*.
 *
 * @param inviteId The invitation's own id
 * @param database The connection; defaults to the process's
 * @returns The row, or `null`
 */
export function findSessionInvite(
  inviteId: string,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return (
    database.db.select().from(sessionInvite).where(eq(sessionInvite.id, inviteId)).get() ?? null
  );
}

/**
 * Whether this address already has a live invitation to this table (v3 Req 38.3)
 *
 * *Live* is the same four conditions the invitee's own listing applies, and they are written once
 * here so that "what the DM is told is pending" and "what the invitee is shown" cannot drift into
 * two different answers.
 *
 * @param sessionId Which table
 * @param email The **normalised** address
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The pending row, or `null`
 */
export function pendingInviteFor(
  sessionId: string,
  email: string,
  now: number,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return (
    database.db
      .select()
      .from(sessionInvite)
      .where(
        and(eq(sessionInvite.sessionId, sessionId), eq(sessionInvite.email, email), pending(now))
      )
      .get() ?? null
  );
}

/**
 * The four conditions that make an invitation *waiting to be answered*
 *
 * One expression, used by both listings and by the pending-duplicate check, because three copies of
 * "not revoked, not declined, not redeemed, not expired" is three chances for one of them to lose a
 * clause.
 *
 * @param now Epoch milliseconds
 * @returns The condition
 */
function pending(now: number) {
  return and(
    isNull(sessionInvite.revokedAt),
    isNull(sessionInvite.declinedAt),
    isNull(sessionInvite.redeemedAt),
    gt(sessionInvite.expiresAt, now)
  );
}

/**
 * Every addressed invitation this table has ever sent, newest first (v3 Req 38.4)
 *
 * **Including the answered, expired and revoked ones**, which is the point of the DM's list: *they
 * declined* is the thing a DM most needs to see, and a listing that showed only what was pending
 * would make declining look identical to never having been invited.
 *
 * @param sessionId Which table
 * @param database The connection; defaults to the process's
 * @returns The rows
 */
export function listAddressedInvites(
  sessionId: string,
  database: Database = getDatabase()
): SessionInviteRow[] {
  return database.db
    .select()
    .from(sessionInvite)
    .where(and(eq(sessionInvite.sessionId, sessionId), isNotNull(sessionInvite.email)))
    .orderBy(desc(sessionInvite.createdAt))
    .all();
}

/** One invitation as the Account it is addressed to needs to read it (v3 Req 38.7) */
export interface PendingInvitationRow {
  id: string;
  sessionName: string;
  /** The DM's own name, joined in — *who invited them* is half of what the requirement asks for */
  invitedBy: string;
  expiresAt: number;
}

/**
 * Everything waiting for one address, soonest to expire first (v3 Req 38.5, 38.6)
 *
 * **Keyed on the address rather than on an account id**, which is what makes v3 Req 38.6 work
 * without a second mechanism: an invitation sent to somebody who had not registered yet is found by
 * the same query the moment they do, because it was never bound to an account in the first place.
 *
 * The DM's name comes from a join rather than from a second round trip — one query answers the whole
 * card the invitee reads.
 *
 * @param email The **normalised** address
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The pending invitations
 */
export function listPendingInvitationsFor(
  email: string,
  now: number,
  database: Database = getDatabase()
): PendingInvitationRow[] {
  return (
    database.db
      .select({
        id: sessionInvite.id,
        sessionName: gameSession.name,
        invitedBy: authUser.name,
        expiresAt: sessionInvite.expiresAt,
      })
      .from(sessionInvite)
      .innerJoin(gameSession, eq(gameSession.id, sessionInvite.sessionId))
      // A **left** join on the DM, so an invitation outlives the account that sent it rather than
      // vanishing from the invitee's list for a reason they could never discover
      .leftJoin(authUser, eq(authUser.id, gameSession.dmAccountId))
      .where(and(eq(sessionInvite.email, email), pending(now)))
      .orderBy(asc(sessionInvite.expiresAt))
      .all()
      .map((row) => ({ ...row, invitedBy: row.invitedBy ?? 'Somebody' }))
  );
}

/**
 * Stamp one invitation as answered, taken back or used up
 *
 * One function for the three writes rather than three near-identical statements, because what
 * differs between them is a column name and what is the same is *only if it is still pending* — the
 * clause that makes accepting an invitation the invitee declined a second earlier land as "nothing
 * to answer" instead of as a race.
 *
 * @param inviteId Which invitation
 * @param patch The column to stamp, and what to stamp it with
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when it was no longer pending
 */
function settle(
  inviteId: string,
  patch: Partial<typeof sessionInvite.$inferInsert>,
  now: number,
  database: Database
): SessionInviteRow | null {
  return (
    database.db
      .update(sessionInvite)
      .set(patch)
      .where(and(eq(sessionInvite.id, inviteId), pending(now)))
      .returning()
      .get() ?? null
  );
}

/**
 * The invitee turned it down (v3 Req 38.4)
 *
 * @param inviteId Which invitation
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when it was no longer pending
 */
export function declineInvite(
  inviteId: string,
  now: number,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return settle(inviteId, { declinedAt: now }, now, database);
}

/**
 * The invitee took it up (v3 Req 38.4, 38.7)
 *
 * @param inviteId Which invitation
 * @param accountId Who redeemed it
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when it was no longer pending
 */
export function redeemInviteById(
  inviteId: string,
  accountId: string,
  now: number,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return settle(inviteId, { redeemedAt: now, redeemedByAccountId: accountId }, now, database);
}

/**
 * The DM took one back (v3 Req 38.4)
 *
 * **By id, so it touches exactly one letter** — the counterpart to {@link revokeSessionInvites},
 * which is about the shared door and deliberately leaves these alone.
 *
 * @param inviteId Which invitation
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when it was no longer pending
 */
export function revokeInviteById(
  inviteId: string,
  now: number,
  database: Database = getDatabase()
): SessionInviteRow | null {
  return settle(inviteId, { revokedAt: now }, now, database);
}
