/**
 * Whether the database can actually be used right now (TICKET-DB-01)
 *
 * Lives in `db/` rather than in the route because **only `db/` and `repositories/` may reach the
 * connection** — a rule TICKET-DX-08 makes mechanical. `routes/health.ts` asks this question; it
 * does not open anything.
 *
 * **Validates: v3 Req 47.5**
 */

import { getDatabase } from './client';
import { appliedMigrations } from './migrate';

/** What the health endpoint reports about the database */
export interface DatabaseHealth {
  reachable: boolean;
  /** The last migration applied, or `null` when none has been */
  migration: string | null;
}

/**
 * Ask the database whether it is there
 *
 * A real query rather than "did the connection object get created": a file can be opened and then
 * become unreadable, and the answer that matters is whether a statement runs *now*.
 *
 * @returns Reachability and the applied migration; never throws
 */
export function databaseHealth(): DatabaseHealth {
  try {
    return { reachable: true, migration: appliedMigrations(getDatabase()).at(-1) ?? null };
  } catch {
    // The reason is deliberately not returned — an unauthenticated endpoint saying *why* the
    // database is unreachable is an unauthenticated endpoint describing the deployment
    return { reachable: false, migration: null };
  }
}
