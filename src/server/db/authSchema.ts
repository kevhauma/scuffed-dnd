/**
 * Better Auth's own four tables (TICKET-AUTH-01)
 *
 * **These are the library's, not ours** ([D3](../../../docs/v3.0_backend/overview.md#d3--authentication-through-better-auth)).
 * The shape below is what `getAuthTables()` says Better Auth expects, and
 * [`authSchema.test.ts`](./authSchema.test.ts) asserts the two still agree — so a Better Auth
 * upgrade that adds a column is a failing test rather than a runtime error on somebody's first
 * sign-in. Do not add application columns here; the app's own per-account data belongs on DB-01's
 * tables, keyed by the account id.
 *
 * **The word *session* is ambiguous from here on, and the naming is how that is handled.** An
 * Auth_Session is `authSession` and a Game_Session is `gameSession`, always, in every variable name
 * — while the *table* keeps Better Auth's default name so nothing has to be configured to match.
 * The glossary says so and this file is where the habit starts.
 *
 * **Timestamps are seconds here and milliseconds next door**, which is worth stating rather than
 * discovering: DB-01's tables store epoch **milliseconds** as plain integers, and Drizzle's
 * `mode: 'timestamp'` — which is what Better Auth's adapter round-trips `Date` through — stores
 * **seconds**. Two conventions in one file would be a bug; two conventions in two files, one of
 * which belongs to a library, is the cost of not forking the library.
 *
 * **Validates: v3 Req 30.1, 30.3, 30.4, 46.3**
 */

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * An Account — Better Auth calls it a user (v3 Req 30.1)
 *
 * `email` is unique, which is what makes v3 Req 30.2's refusal a constraint rather than a check a
 * handler has to remember. `emailVerified` exists because Better Auth's schema has it; **nothing
 * sets it true**, because verification needs outbound email and this application sends none
 * ([D12](../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)).
 */
export const authUser = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .$defaultFn(() => false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * An Auth_Session — the thing the cookie names (v3 Req 30.4, 30.5, 48)
 *
 * `token` is unique and is what the cookie carries; the row is what sign-out deletes, which is why
 * a captured cookie stops working rather than merely being cleared client-side.
 *
 * **`expiresAt` carries both of AUTH-04's lifetimes at once**, which is the decision this table
 * rests on. Renewal writes `min(now + idle, createdAt + absolute)`, so the library's own
 * "is this session expired?" check enforces the **absolute ceiling** everywhere it already enforces
 * the idle one — on `/get-session`, on the socket upgrade, on every route — with no second check to
 * remember and no path that can miss it. `createdAt` is never rewritten, and that is what makes it
 * the start of the chain rather than the start of the current *window*.
 *
 * **The two `previousToken` columns are the grace window** (TICKET-AUTH-04). Rotation replaces
 * `token` in place, and without them the losing side of a two-tab race presents a token the server
 * has never heard of — at which point Better Auth clears the cookie and signs *every* tab out. The
 * previous identifier stays resolvable for a few seconds so that the tab which lost the race
 * survives; see [`sessionLifetime.ts`](../auth/sessionLifetime.ts) for the rule and
 * [`authAdapter.ts`](./authAdapter.ts) for where it is applied.
 *
 * They are declared to Better Auth through `session.additionalFields`, so `getAuthTables()` knows
 * about them and `authSchema.test.ts` keeps comparing the two sets rather than being told to make
 * an exception.
 */
export const authSession = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    /** The identifier this session had before its last rotation, honoured until the moment below */
    previousToken: text('previous_token'),
    /** When the previous identifier stops being honoured — null when there has been no rotation */
    previousTokenExpiresAt: integer('previous_token_expires_at', { mode: 'timestamp' }),
  },
  (table) => [
    // **Indexed because the grace lookup runs on every *failed* session lookup** — which is every
    // request bearing a stale, forged or already-rotated-away cookie. Unindexed that is a full scan
    // of `session`, i.e. an unauthenticated and very cheap way to make the server work.
    index('session_previous_token_idx').on(table.previousToken),
  ]
);

/**
 * A credential or a linked identity (v3 Req 30.3, 31.3)
 *
 * One row per way of signing in to an Account: the email/password credential is a row with
 * `providerId = 'credential'` and a **salted hash** in `password`, and TICKET-AUTH-02's Google and
 * Discord identities are further rows against the same `userId`. That is the shape that makes
 * linking a row rather than a migration.
 *
 * `accessToken` / `refreshToken` exist because the library's schema has them. **We deliberately do
 * not keep a Provider's refresh token** (v3 Req 48.10) — it would authorise calls to Google and
 * Discord on the Account's behalf, and this application makes none.
 */
export const authAccount = sqliteTable('account', {
  id: text('id').primaryKey(),
  issuer: text('issuer').notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

/**
 * Short-lived tokens Better Auth issues for flows we do not enable
 *
 * Empty in practice: address verification and password reset are the two things this table is for,
 * and D12 rules out both. It exists because the library's adapter writes to it during OAuth state
 * handling (AUTH-02), and a missing table is a runtime failure rather than a disabled feature.
 */
export const authVerification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});
