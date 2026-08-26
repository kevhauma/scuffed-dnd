/**
 * The server's own model, as tables (TICKET-DB-01)
 *
 * **What is normalised and what is a document is the whole decision here**
 * ([D4](../../../docs/v3.0_backend/overview.md#d4--a-ruleset-is-stored-as-a-json-document-not-normalised)):
 *
 * - **Documents** — a `Configuration`, a Snapshot of one, a Character's player state. Fourteen
 *   interlinked entity kinds with id-resolved formula references and stat ordering; normalising
 *   them would produce a second schema to keep in step with `#shared/types/config` by hand and a
 *   second validator beside `validateConfigurationShape`, and every query the app makes is *"give
 *   me the whole thing"*. They are JSON text, with `schemaVersion` and `revision` as real columns
 *   because those are the two things the server queries and gates on.
 * - **Normalised** — accounts' ownership, memberships, invites and events. This is the server's own
 *   model rather than the ruleset's, and it is what the server joins on.
 *
 * **Auth tables are next door.** TICKET-AUTH-01 brought Better Auth's own schema against this same
 * database file, and it lives in [`authSchema.ts`](./authSchema.ts) because it is the *library's*
 * shape rather than ours — re-exported below so `import * as schema` still sees one database. The
 * account columns here are still ids the server holds without a foreign key on them, for the
 * reason the next paragraph gives.
 *
 * **Those account foreign keys are not planned to be added afterwards, and that is a decision
 * rather than an oversight.** SQLite has no `ADD CONSTRAINT`; adding one means the twelve-step
 * table recreate, whose generated SQL relies on `PRAGMA foreign_keys = OFF` — which is a **no-op
 * inside a transaction**, and drizzle's migrator runs every file in one. With foreign keys on, the
 * `DROP TABLE` in that recreate fires every `ON DELETE CASCADE` below and takes the data with it.
 * If a later ticket decides it wants them, it needs a hand-written migration and its own test, not
 * a `drizzle-kit generate`.
 *
 * **Timestamps are integer epoch milliseconds.** A SQLite text date is a formatting decision that
 * leaks into every comparison.
 *
 * **Validates: v3 Req 46.3, 46.4**
 */

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Better Auth's four tables, which share this database file (TICKET-AUTH-01) */
export * from './authSchema';

/**
 * An epoch-millisecond column
 *
 * A name rather than a behaviour — `integer()` already stores a number. What it buys is that
 * "this is a moment in time" is legible at twelve call sites and searchable in one.
 */
function epochMs(name: string) {
  return integer(name, { mode: 'number' });
}

/**
 * The pair every mutable row carries
 *
 * Three tables have it — `ruleset`, `game_session` and `character` — which is what earns it a
 * helper rather than a third copy. Spread into the column object: `...timestamps()`.
 */
function timestamps() {
  return {
    createdAt: epochMs('created_at').notNull(),
    updatedAt: epochMs('updated_at').notNull(),
  };
}

/**
 * A ruleset owned by an Account (v3 Req 33)
 *
 * `data` is a whole `Configuration` in **stored form** — id-resolved references, exactly what
 * `serializeConfiguration` writes. `revision` starts at 1 and is bumped inside the repository's
 * update, in the same statement that checks the caller's base revision (RUL-02's guard).
 */
export const ruleset = sqliteTable(
  'ruleset',
  {
    id: text('id').primaryKey(),
    /** Better Auth's account id. No foreign key until AUTH-01 creates the table it would point at. */
    ownerAccountId: text('owner_account_id').notNull(),
    name: text('name').notNull(),
    /** The document's own version — the thing `importConfiguration` gates on, not a migration */
    schemaVersion: integer('schema_version').notNull(),
    revision: integer('revision').notNull().default(1),
    /** A `Configuration` as JSON text */
    data: text('data').notNull(),
    ...timestamps(),
  },
  (table) => [index('ruleset_owner_idx').on(table.ownerAccountId)]
);

/** What a game session currently is */
export const SESSION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/**
 * A table playing against a **pinned** Snapshot (v3 Req 37, D7)
 *
 * `snapshot` is a copy of the ruleset taken when the session was created, not a reference to it —
 * a DM editing their ruleset afterwards does not re-price every character mid-game.
 *
 * `ruleset_id` is therefore **nullable, `ON DELETE SET NULL`**: the session already holds
 * everything it needs to play, so deleting the ruleset it came from must not delete the game. What
 * is lost is the pointer back to the original, which is provenance rather than rules.
 */
export const gameSession = sqliteTable(
  'game_session',
  {
    id: text('id').primaryKey(),
    rulesetId: text('ruleset_id').references(() => ruleset.id, { onDelete: 'set null' }),
    /**
     * Who the DM is — **authoritative** (v3 Req 39.2)
     *
     * The fact lives in two places, and this is the one that wins: `session_member` carries a
     * mirroring row with `role = 'dm'` so that one query answers "who is at this table", and a
     * partial unique index there stops the mirror holding two. GAM-04's transfer updates both in
     * one transaction. Better Auth's account id — see the note on `ruleset.ownerAccountId`.
     */
    dmAccountId: text('dm_account_id').notNull(),
    name: text('name').notNull(),
    // Typed at the type level only — SQLite has no enum, so the generated SQL is plain `text`, and
    // what this buys is that a handler cannot write 'Active' and have it stored
    status: text('status', { enum: [SESSION_STATUS.ACTIVE, SESSION_STATUS.ARCHIVED] })
      .notNull()
      .default(SESSION_STATUS.ACTIVE),
    /** The pinned `Configuration`, as JSON text */
    snapshot: text('snapshot').notNull(),
    snapshotSchemaVersion: integer('snapshot_schema_version').notNull(),
    snapshotTakenAt: epochMs('snapshot_taken_at').notNull(),
    ...timestamps(),
  },
  (table) => [
    index('game_session_dm_idx').on(table.dmAccountId),
    // SQLite does not index a child key for you. Req 33.7 — "refuse to delete a Ruleset that a
    // Game_Session was created from" — is literally a lookup on this column, and the SET NULL
    // above scans the table on every ruleset delete
    index('game_session_ruleset_idx').on(table.rulesetId),
  ]
);

/** What an Account may do inside a session (v3 Req 39) */
export const MEMBER_ROLE = {
  DM: 'dm',
  PLAYER: 'player',
} as const;

export type MemberRole = (typeof MEMBER_ROLE)[keyof typeof MEMBER_ROLE];

/**
 * Who is at the table (v3 Req 39)
 *
 * **`ON DELETE CASCADE`**: a membership is part of the session rather than a thing in its own
 * right, and a membership of a session that no longer exists grants nothing. Same for the invites,
 * characters and events below — deleting a session deletes the game, deliberately, and RUL/GAM's
 * routes are where "are you sure" belongs.
 */
export const sessionMember = sqliteTable(
  'session_member',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSession.id, { onDelete: 'cascade' }),
    /** Better Auth's account id — see the note on `ruleset.ownerAccountId` */
    accountId: text('account_id').notNull(),
    role: text('role', { enum: [MEMBER_ROLE.DM, MEMBER_ROLE.PLAYER] }).notNull(),
    joinedAt: epochMs('joined_at').notNull(),
  },
  (table) => [
    // One membership per Account per session — the constraint rather than a check in a handler
    uniqueIndex('session_member_unique').on(table.sessionId, table.accountId),
    // …and exactly one DM per session (v3 Req 39.2), which is the same kind of rule and deserves
    // the same kind of answer. A partial index: only the `dm` rows have to be unique per session.
    // `sql.raw` because a bound parameter cannot appear in an index predicate — drizzle-kit would
    // emit a literal `?` into the migration — and going through MEMBER_ROLE keeps the SQL text and
    // the TypeScript constant from drifting apart
    uniqueIndex('session_member_one_dm')
      .on(table.sessionId)
      .where(sql`${table.role} = ${sql.raw(`'${MEMBER_ROLE.DM}'`)}`),
    index('session_member_account_idx').on(table.accountId),
  ]
);

/**
 * An invitation to a session, by code or by email address (v3 Req 38)
 *
 * `email` is an **address book, not a transport** (D12): nothing is sent, and the Account holding
 * that address sees a pending invitation in the app. An address nobody has registered yet holds
 * the invite pending until someone does, which is why this is a plain nullable column rather than
 * a reference to an account.
 *
 * Revoked, declined and redeemed are timestamps rather than flags, because *when* is the question
 * asked about all three and a boolean cannot answer it. All three exist because v3 Req 38.4 asks
 * for **a distinct message for each** of expired, revoked, declined and redeemed — an invite that
 * the invitee turned down is a different answer from one the DM took back, and a single `used_at`
 * would have to guess.
 */
export const sessionInvite = sqliteTable(
  'session_invite',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSession.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    email: text('email'),
    expiresAt: epochMs('expires_at').notNull(),
    revokedAt: epochMs('revoked_at'),
    declinedAt: epochMs('declined_at'),
    redeemedAt: epochMs('redeemed_at'),
    /** Better Auth's account id — see the note on `ruleset.ownerAccountId` */
    redeemedByAccountId: text('redeemed_by_account_id'),
    createdAt: epochMs('created_at').notNull(),
  },
  (table) => [
    // A code is how a table actually joins, so it has to be unique across every session
    uniqueIndex('session_invite_code_unique').on(table.code),
    index('session_invite_email_idx').on(table.email),
    // The child key again — GAM-03's revoke/reissue and the lobby listing both filter on it, and
    // the CASCADE above scans it on every session delete
    index('session_invite_session_idx').on(table.sessionId),
  ]
);

/**
 * A character, created **per session** against its Snapshot (v3 Req 40)
 *
 * `data` holds only what the Kernel sanctions as player state. That set grows twice this milestone
 * — `grantedStatPoints` in DM-01, `purse` in CUR-02 — and both are **document** changes rather than
 * migrations, which is the point of D4.
 *
 * **`session_id` is nullable, and that is TICKET-IO-04's doing** (v3 Req 36.5). A character uploaded
 * from a browser was built against a *local* ruleset rather than against any Snapshot, so it belongs
 * to the Account and sits at no table — which is a real state and not a placeholder for one. The
 * alternative was inventing a session to hold them, which would put characters in a game nobody
 * started and make "who is at this table" a lie. TICKET-CHAR-04 decides whether one can later be
 * brought into a session; until then `session_id IS NULL` means *not at a table*, and
 * `requireCharacterWriter` reads it as "only the owner may write to this one".
 */
export const character = sqliteTable(
  'character',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => gameSession.id, { onDelete: 'cascade' }),
    /** Better Auth's account id — see the note on `ruleset.ownerAccountId` */
    ownerAccountId: text('owner_account_id').notNull(),
    name: text('name').notNull(),
    revision: integer('revision').notNull().default(1),
    /** The player state as JSON text */
    data: text('data').notNull(),
    ...timestamps(),
  },
  (table) => [
    index('character_session_idx').on(table.sessionId),
    index('character_owner_idx').on(table.ownerAccountId),
  ]
);

/**
 * Which Accounts have already been offered the upload (v3 Req 36.6, TICKET-IO-04)
 *
 * **Per Account and server-side, both deliberately.** Two Accounts on one machine must each be
 * asked, and a LocalStorage flag would be cleared by exactly the browser maintenance that makes
 * people sign in fresh — so the one place that can answer "has *this* Account been asked?" is here.
 *
 * A row means *asked*, and the primary key is what makes claiming it a single statement:
 * `INSERT … ON CONFLICT DO NOTHING` prompts exactly once even if two tabs ask at the same moment.
 * There is no column for the answer, because there is no answer to record — declining the prompt and
 * never seeing it again are the same outcome, and the action stays reachable from the ruleset list
 * forever either way.
 */
export const accountUploadPrompt = sqliteTable('account_upload_prompt', {
  /** Better Auth's account id — see the note on `ruleset.ownerAccountId` */
  accountId: text('account_id').primaryKey(),
  promptedAt: epochMs('prompted_at').notNull(),
});

/**
 * Everything that happened, in order (v3 Req 44)
 *
 * **Append-only, and `seq` is unique per session by constraint** rather than by application code
 * being careful. LIVE-02 fans these out and LIVE-03 replays from a sequence number, and both of
 * those rest on the number being gapless and unrepeatable — a property a `UNIQUE` index holds and
 * a read-then-write in a handler does not.
 */
export const event = sqliteTable(
  'event',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => gameSession.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    /** Better Auth's account id, or null when the server itself acted */
    actorAccountId: text('actor_account_id'),
    type: text('type').notNull(),
    /** The event's own shape as JSON text */
    payload: text('payload').notNull(),
    createdAt: epochMs('created_at').notNull(),
  },
  (table) => [uniqueIndex('event_session_seq_unique').on(table.sessionId, table.seq)]
);
