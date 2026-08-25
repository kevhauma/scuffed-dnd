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

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
 * An Auth_Session — the thing the cookie names (v3 Req 30.4, 30.5)
 *
 * `token` is unique and is what the cookie carries; the row is what sign-out deletes, which is why
 * a captured cookie stops working rather than merely being cleared client-side. `expiresAt` is the
 * lifetime AUTH-04 turns into a rolling one.
 */
export const authSession = sqliteTable('session', {
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
});

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
