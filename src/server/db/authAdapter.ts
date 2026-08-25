/**
 * The Drizzle adapter Better Auth is handed (TICKET-AUTH-01)
 *
 * **This lives in `db/` for a rule, not for tidiness.** `queries-belong-to-repositories` (DX-08)
 * says only `db/`, `repositories/` and `testing/` may import the connection or the query builder —
 * and building the adapter needs both. Putting it here means `auth/` receives an adapter and never
 * learns there is a database, which keeps the rule intact rather than earning `auth/` an exemption
 * it would then keep forever.
 *
 * It is resolved **per call** rather than once, because the process's database can be replaced —
 * `withTestDatabase` does exactly that (DX-06), and an adapter that captured the connection at
 * module load would send every test's sign-up to whichever database happened to be open first.
 *
 * **Validates: v3 Req 46.1**
 */

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDatabase } from './client';
import * as schema from './schema';

/**
 * Which database the process currently has, as an opaque identity
 *
 * `auth/` memoises its Better Auth instance against this rather than rebuilding one per request:
 * constructing it assembles a route table, and doing that on every call would be a real cost for
 * a value that changes only in tests. Returned as `object` so that nothing outside `db/` can do
 * anything with it except compare it — which is the whole of what it is for.
 *
 * @returns The current connection, usable only as a cache key
 */
export function currentDatabaseKey(): object {
  return getDatabase();
}

/**
 * An adapter over whichever database this process currently has
 *
 * @returns Better Auth's Drizzle adapter, bound to the current connection
 */
export function authDatabaseAdapter() {
  return drizzleAdapter(getDatabase().db, {
    provider: 'sqlite',
    // Named explicitly rather than left to the adapter's own discovery, so that a table renamed in
    // `authSchema.ts` is a compile error here rather than a "no such table" at somebody's sign-in
    schema: {
      user: schema.authUser,
      session: schema.authSession,
      account: schema.authAccount,
      verification: schema.authVerification,
    },
  });
}
