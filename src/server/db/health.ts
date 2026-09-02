/**
 * Whether the database can actually be used right now (TICKET-DB-01)
 *
 * Lives in `db/` rather than in the route because **only `db/` and `repositories/` may reach the
 * connection** — a rule TICKET-DX-08 makes mechanical. `routes/health.ts` asks this question; it
 * does not open anything.
 *
 * **The shape moved to the Kernel in TICKET-POL-03.** It is part of two wire answers now — the
 * healthy body and the 503's `details` — and a shape that appears in two answers is a contract
 * rather than an implementation detail, so it is declared where both roots can name it.
 *
 * **Validates: v3 Req 47.5**
 */

import type { DatabaseHealth } from '#shared/types/api';
import { getDatabase } from './client';
import { appliedMigrations } from './migrate';

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
