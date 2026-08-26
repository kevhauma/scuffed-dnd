/**
 * Every query that touches a `session_member` row (TICKET-AUTH-03)
 *
 * **Named for the session rather than for the membership**, because they are one aggregate: a
 * session without its membership rows is not a table anybody can sit at, D7's Snapshot is pinned to
 * the session, and the queries GAM-01 adds here will join the two. Splitting them would be
 * splitting a thing, not a layer.
 *
 * **AUTH-03 landed one read, because the guards needed exactly one**, and deleted a `findGameSession`
 * and a `hasSessionRole` drafted beside it: nothing called either, and an exported function with no
 * caller is a claim that something uses it. **TICKET-GAM-01 is the ticket that had callers** and adds
 * the session's own lifecycle — create, read, list, archive and the Snapshot refresh. GAM-02 through
 * GAM-04 bring join, remove, leave and transfer-DM against their own routes and their own
 * authorization tests.
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

import { and, asc, count, desc, eq } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import {
  authUser,
  character,
  gameSession,
  MEMBER_ROLE,
  type MemberRole,
  SESSION_STATUS,
  type SessionStatus,
  sessionMember,
} from '../db/schema';
import type { CharacterRow } from './characterRepository';
import { appendEvent } from './eventRepository';

/** Somebody's seat at a table, and the role they hold in it */
export type SessionMemberRow = typeof sessionMember.$inferSelect;

/** A game session as the server holds it — `snapshot` is still JSON text (D4) */
export type GameSessionRow = typeof gameSession.$inferSelect;

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

/** What starting a table needs to be told (TICKET-GAM-01) */
export interface NewGameSession {
  id: string;
  /** The ruleset it was created from — provenance, not rules; the Snapshot is the rules (D7) */
  rulesetId: string;
  /** The Account starting it, seated as DM in the same write */
  dmAccountId: string;
  name: string;
  /** The pinned `Configuration` as JSON text — copied by the caller, never referenced */
  snapshot: string;
  snapshotSchemaVersion: number;
  /** Epoch milliseconds; passed in rather than read from the clock so a caller can be deterministic */
  now: number;
  /** The membership row's id, minted by the caller like every other id here */
  memberId: string;
}

/**
 * Start a table, and seat its DM (v3 Req 37.1)
 *
 * **Both rows or neither.** The DM is recorded on the session *and* as a `session_member` row with
 * role `dm` — a denormalisation the schema explains and GAM-04's transfer relies on — and a session
 * whose membership row failed to write is a table its own DM cannot see: `requireDM` reads
 * `session_member`, so the creator would be locked out of the game they just started. One
 * transaction is what makes that unreachable rather than unlikely.
 *
 * **The statements go through the `tx` handle**, not through the outer `database`. On
 * `better-sqlite3` those are the same synchronous connection, so either would work today — and
 * *"correct because the driver happens to be synchronous"* is the kind of correctness that stops
 * being true silently. Using the handle drizzle hands the callback makes it correct for the reason
 * it looks correct. It is also why every repository function here is sync: an `await` inside a
 * transaction callback would commit around the thing it was meant to wrap.
 *
 * @param input The session and the seat
 * @param database The connection; defaults to the process's
 * @returns The stored session row
 */
export function insertGameSession(
  input: NewGameSession,
  database: Database = getDatabase()
): GameSessionRow {
  return database.db.transaction((tx) => {
    const session = tx
      .insert(gameSession)
      .values({
        id: input.id,
        rulesetId: input.rulesetId,
        dmAccountId: input.dmAccountId,
        name: input.name,
        status: SESSION_STATUS.ACTIVE,
        snapshot: input.snapshot,
        snapshotSchemaVersion: input.snapshotSchemaVersion,
        snapshotTakenAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning()
      .get();

    tx.insert(sessionMember)
      .values({
        id: input.memberId,
        sessionId: session.id,
        accountId: input.dmAccountId,
        role: MEMBER_ROLE.DM,
        joinedAt: input.now,
      })
      .run();

    return session;
  });
}

/**
 * What taking a seat needs to be told (TICKET-GAM-02)
 *
 * **The session row rather than its id**, and the reason is the same one that named
 * `insertUnseatedCharacter`: `routes/routeGuards.test.ts` reads a handler that spells `sessionId` as
 * *this route had better call a resource guard*, and `redeemInvite` is the one route in the
 * milestone that cannot — redeeming a code is the act of becoming a Member. Taking the loaded row
 * keeps the word out of that handler, and is the better signature anyway: every caller has the row,
 * because every caller had to resolve it before it could seat anybody.
 */
export interface NewSessionMember {
  id: string;
  session: GameSessionRow;
  accountId: string;
  role: MemberRole;
  /** Epoch milliseconds */
  now: number;
}

/** A seat taken, and whether this call is what took it */
export interface SeatResult {
  membership: SessionMemberRow;
  /** False when the Account was already at the table — the row is the one they already had */
  joined: boolean;
}

/**
 * Seat an Account at a table, or hand back the seat they already have (v3 Req 38.7)
 *
 * **Idempotent by constraint rather than by checking first.** `session_member_unique` already
 * refuses a second row per Account per session, so `ON CONFLICT DO NOTHING` and a read-back is both
 * shorter than read-then-insert and correct under a double-click — where read-then-insert is a race
 * that ends in a constraint error the User reads as *you are not welcome*.
 *
 * The ticket is emphatic that this matters: somebody will click the link twice, bookmark it, or
 * paste it into the group chat and click their own paste, and an error there is exactly the wrong
 * answer.
 *
 * @param input Who is sitting down, where, and in what role
 * @param database The connection; defaults to the process's
 * @returns Their membership, and whether it is new
 */
export function seatSessionMember(
  input: NewSessionMember,
  database: Database = getDatabase()
): SeatResult {
  const inserted = database.db
    .insert(sessionMember)
    .values({
      id: input.id,
      sessionId: input.session.id,
      accountId: input.accountId,
      role: input.role,
      joinedAt: input.now,
    })
    .onConflictDoNothing()
    .returning()
    .all();

  if (inserted.length > 0) return { membership: inserted[0], joined: true };

  const existing = findSessionMember(input.session.id, input.accountId, database);

  // The conflict clause fired, so a row exists by definition. A `null` here would mean the unique
  // index and this read disagree about what a membership is keyed on.
  if (!existing) {
    throw new Error(`seatSessionMember: ${input.accountId} conflicted but has no seat`);
  }

  return { membership: existing, joined: false };
}

/**
 * One session by id
 *
 * **This is a read of the session, not a permission check.** Every caller pairs it with
 * `requireMember` or `requireDM`, which ask `session_member` — so a row coming back here says
 * nothing about who may see it.
 *
 * @param id Which session
 * @param database The connection; defaults to the process's
 * @returns The row, or `null` when there is none
 */
export function findGameSession(
  id: string,
  database: Database = getDatabase()
): GameSessionRow | null {
  return database.db.select().from(gameSession).where(eq(gameSession.id, id)).get() ?? null;
}

/**
 * A session row **without its Snapshot** (TICKET-GAM-01)
 *
 * `RulesetSummaryRow`'s counterpart, and it exists for the identical reason: a listing that carried
 * whole documents would hand a client tens of kilobytes per table it is merely naming, and invite one
 * that renders from the list and then plays against the copy it happens to hold. The query refuses to
 * *select* the column and this refuses to *name* it.
 */
export interface GameSessionSummaryRow {
  id: string;
  rulesetId: string | null;
  name: string;
  status: SessionStatus;
  snapshotTakenAt: number;
  createdAt: number;
  updatedAt: number;
  /** What the asking Account is at this table — the join is what makes one query enough */
  role: SessionMemberRow['role'];
}

/**
 * The columns a summary is, named once so the listing cannot quietly grow a `snapshot`
 *
 * **Exactly what `toSessionSummary` puts on the wire, and nothing else.** `dmAccountId` and
 * `snapshotSchemaVersion` were here until the GAM-01 review pointed out that no caller reads either
 * — a selected column nothing maps is a field introduced dead, and this app has no external
 * consumers to be keeping it for. TICKET-GAM-04's lobby wants `dmAccountId`; it adds it back with
 * the surface that reads it.
 */
const SUMMARY_COLUMNS = {
  id: gameSession.id,
  rulesetId: gameSession.rulesetId,
  name: gameSession.name,
  status: gameSession.status,
  snapshotTakenAt: gameSession.snapshotTakenAt,
  createdAt: gameSession.createdAt,
  updatedAt: gameSession.updatedAt,
  role: sessionMember.role,
};

/**
 * Every table one Account sits at, newest first (v3 Req 37)
 *
 * **Joined on the membership rather than on `dm_account_id`**, which is the same decision
 * `auth/guards.ts` records: `session_member` is the authority on who is at a table, and a listing
 * that read the denormalised column would show a DM their games and a player none of theirs.
 *
 * @param accountId Whose tables
 * @param database The connection; defaults to the process's
 * @returns Their sessions, without the Snapshots
 */
export function listSessionsForAccount(
  accountId: string,
  database: Database = getDatabase()
): GameSessionSummaryRow[] {
  return database.db
    .select(SUMMARY_COLUMNS)
    .from(sessionMember)
    .innerJoin(gameSession, eq(sessionMember.sessionId, gameSession.id))
    .where(eq(sessionMember.accountId, accountId))
    .orderBy(desc(gameSession.updatedAt))
    .all();
}

/**
 * Pin a new Snapshot onto a session (v3 Req 37.3)
 *
 * **Whether the refresh is safe is decided above this line** — the route compares every character
 * against the candidate Snapshot and refuses when one would break (v3 Req 37.6). What is left here
 * is the write, and the one thing worth saying about it is what it touches: the Snapshot, its
 * version and `snapshot_taken_at`, and nothing else. `ruleset_id` is unchanged because the session
 * still came from that ruleset, and `created_at` is unchanged because the table is the same table.
 *
 * @param id Which session
 * @param snapshot The new pinned document as JSON text
 * @param schemaVersion The document's own version
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when there is no such session
 */
export function updateSessionSnapshot(
  id: string,
  snapshot: string,
  schemaVersion: number,
  now: number,
  database: Database = getDatabase()
): GameSessionRow | null {
  return (
    database.db
      .update(gameSession)
      .set({
        snapshot,
        snapshotSchemaVersion: schemaVersion,
        snapshotTakenAt: now,
        updatedAt: now,
      })
      .where(eq(gameSession.id, id))
      .returning()
      .get() ?? null
  );
}

/** What pinning a new Snapshot needs to be told, log entry included */
export interface SnapshotRefresh {
  sessionId: string;
  /** The new pinned document as JSON text */
  snapshot: string;
  schemaVersion: number;
  /** The Account that asked for it, for the Event's actor */
  actorAccountId: string;
  /** The Event's id, minted by the caller like every other id here */
  eventId: string;
  type: string;
  /** The Event's own shape as JSON text */
  payload: string;
  now: number;
}

/**
 * Pin a new Snapshot **and** record that it happened (v3 Req 37.3)
 *
 * **One transaction, because the two halves are one fact.** `appendEvent` can be refused — its
 * `UNIQUE(session_id, seq)` index is what makes the log gapless, and the repository deliberately
 * does not retry — so a refresh that wrote the Snapshot and then failed to write the Event would
 * have moved the rules under a live table with nothing in the log to say so. LIVE-02 fans out from
 * that log, so *nobody at the table would be told*. It is the identical argument
 * {@link insertGameSession} makes for the session and its DM's seat, one route over.
 *
 * @param input The Snapshot and the Event to record beside it
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when there is no such session — in which case nothing is written
 */
export function refreshSessionSnapshot(
  input: SnapshotRefresh,
  database: Database = getDatabase()
): GameSessionRow | null {
  return database.db.transaction(() => {
    const row = updateSessionSnapshot(
      input.sessionId,
      input.snapshot,
      input.schemaVersion,
      input.now,
      database
    );

    // Nothing to record against a session that is not there, and nothing has been written either —
    // the update matched no row
    if (!row) return null;

    appendEvent(
      {
        id: input.eventId,
        sessionId: input.sessionId,
        actorAccountId: input.actorAccountId,
        type: input.type,
        payload: input.payload,
        now: input.now,
      },
      database
    );

    return row;
  });
}

/**
 * Put a session beyond writing (v3 Req 37.5)
 *
 * Archiving is a status, not a delete: the game is readable forever afterwards — its Snapshot, its
 * characters and its Event log all stay — and only writes are refused. There is deliberately no
 * un-archive here; whether a table can be reopened is a question GAM-04 is closer to than this is,
 * and a function nothing calls would be an answer nobody has given.
 *
 * @param id Which session
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The updated row, or `null` when there is no such session
 */
export function archiveGameSession(
  id: string,
  now: number,
  database: Database = getDatabase()
): GameSessionRow | null {
  return (
    database.db
      .update(gameSession)
      .set({ status: SESSION_STATUS.ARCHIVED, updatedAt: now })
      .where(eq(gameSession.id, id))
      .returning()
      .get() ?? null
  );
}

/**
 * Every character at a table (TICKET-GAM-01)
 *
 * Here rather than in `characterRepository` because the question is *about the session* — it is what
 * a Snapshot refresh has to ask before it is allowed to happen (v3 Req 37.6). CHAR-04 brings the
 * reads that are about a character.
 *
 * @param sessionId Which session
 * @param database The connection; defaults to the process's
 * @returns The character rows, `data` still JSON text
 */
export function charactersInSession(
  sessionId: string,
  database: Database = getDatabase()
): CharacterRow[] {
  return database.db.select().from(character).where(eq(character.sessionId, sessionId)).all();
}

/** Who is at a table, with the name their Account signed up with (TICKET-GAM-04) */
export interface SessionMemberRowWithName extends SessionMemberRow {
  /** `null` when the Account's `user` row has gone — the seat outlives the profile */
  name: string | null;
}

/**
 * Everyone at a table, the DM first and then in the order they joined (v3 Req 39.7)
 *
 * **Left-joined on the Account**, so a membership whose `user` row has gone still appears rather
 * than dropping somebody silently out of a roster. Naming them is the route's problem.
 *
 * **Ordered by when they joined, and nothing else.** The lobby shows the DM first, which is a
 * decision about how a roster is *read* and belongs to the route that renders one — a first draft
 * did it here with `ORDER BY role`, which works only because `'dm'` happens to sort before
 * `'player'`, so renaming a `MEMBER_ROLE` value would have silently reordered the page.
 *
 * @param sessionId Which table
 * @param database The connection; defaults to the process's
 * @returns The membership rows, each with a name where there is one
 */
export function listSessionMembers(
  sessionId: string,
  database: Database = getDatabase()
): SessionMemberRowWithName[] {
  return database.db
    .select({
      id: sessionMember.id,
      sessionId: sessionMember.sessionId,
      accountId: sessionMember.accountId,
      role: sessionMember.role,
      joinedAt: sessionMember.joinedAt,
      name: authUser.name,
    })
    .from(sessionMember)
    .leftJoin(authUser, eq(authUser.id, sessionMember.accountId))
    .where(eq(sessionMember.sessionId, sessionId))
    .orderBy(asc(sessionMember.joinedAt))
    .all();
}

/**
 * Take a seat away (v3 Req 39.3, 39.5)
 *
 * **One function for *remove* and for *leave*, because they are one act with two actors.** Who is
 * allowed to do it is the route's question and the guards'; what happens to the table is identical
 * either way, and two functions would be two places for the retention rule to be forgotten.
 *
 * **Nothing touches `character`.** That is the retention rule, and it is enforced by this function
 * doing nothing about it rather than by a `WHERE` somebody has to remember — a departed Member's
 * Characters keep their `session_id` and their `owner_account_id`, which is also what makes a
 * rejoin restore write access without reassigning anything.
 *
 * @param sessionId Which table
 * @param accountId Whose seat
 * @param database The connection; defaults to the process's
 * @returns True when a seat was actually taken away
 */
export function removeSessionMember(
  sessionId: string,
  accountId: string,
  database: Database = getDatabase()
): boolean {
  return (
    database.db
      .delete(sessionMember)
      .where(and(eq(sessionMember.sessionId, sessionId), eq(sessionMember.accountId, accountId)))
      .returning()
      .all().length > 0
  );
}

/**
 * Hand the table over (v3 Req 39.2, 39.4)
 *
 * **Three writes in one transaction, because the invariant spans all three.** The session's
 * `dm_account_id`, the outgoing DM's membership row and the incoming one — and the schema carries a
 * **partial unique index** (`session_member_one_dm`) that refuses two `dm` rows per session, so the
 * demotion has to land before the promotion or the statement fails. Ordered that way deliberately:
 * a transaction that failed halfway would roll back to exactly one DM, which is the criterion.
 *
 * **`session_member` is the authority and `dm_account_id` is the mirror**, which is `auth/guards.ts`'s
 * rule — but both are written, because a listing that read the stale column would show the wrong
 * person running the game.
 *
 * @param sessionId Which table
 * @param from The outgoing DM's account id
 * @param to The incoming DM's account id — they must already be a Member
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns The session **as it is now** — the route answers with it, and a row read before the
 *   write would carry the old `dm_account_id` and the old `updated_at`
 */
export function transferDungeonMaster(
  sessionId: string,
  from: string,
  to: string,
  now: number,
  database: Database = getDatabase()
): GameSessionRow {
  return database.db.transaction((tx) => {
    // **Demote first.** The partial unique index allows one `dm` row per session, so promoting
    // before demoting would fail on the constraint rather than on anything a caller did wrong.
    tx.update(sessionMember)
      .set({ role: MEMBER_ROLE.PLAYER })
      .where(and(eq(sessionMember.sessionId, sessionId), eq(sessionMember.accountId, from)))
      .run();

    const promoted = tx
      .update(sessionMember)
      .set({ role: MEMBER_ROLE.DM })
      .where(and(eq(sessionMember.sessionId, sessionId), eq(sessionMember.accountId, to)))
      .returning()
      .get();

    // The route checked they are a Member before calling; if that is no longer true the whole
    // transaction rolls back rather than leaving a table with no DM at all
    if (!promoted) {
      throw new Error(`transferDungeonMaster: ${to} is not a member of ${sessionId}`);
    }

    return tx
      .update(gameSession)
      .set({ dmAccountId: to, updatedAt: now })
      .where(eq(gameSession.id, sessionId))
      .returning()
      .get();
  });
}
