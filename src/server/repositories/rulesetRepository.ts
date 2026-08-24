/**
 * Every query that touches a `ruleset` row (TICKET-DB-01)
 *
 * **Handlers call repositories; they never build SQL or touch Drizzle.** That is the layering this
 * module exists to start, and TICKET-DX-08 turns it into a dependency-cruiser rule so it stays
 * true without anyone remembering it.
 *
 * The functions here are the ones DB-01's own criteria need — a document that round-trips and a
 * revision that cannot race. TICKET-RUL-01 and RUL-02 add list, rename and delete against their
 * own routes and their own authorization tests; writing them now would be writing them blind.
 *
 * **Validates: v3 Req 46.3, 33.6**
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { ruleset } from '../db/schema';

/**
 * A ruleset row as the server holds it — `data` is still JSON text
 *
 * Inferred from the schema rather than restated. A hand-written copy would let the two disagree
 * *silently*: a column added by a later migration would simply be invisible to every caller,
 * because a wider row assigns cleanly to a narrower declared type.
 */
export type RulesetRow = typeof ruleset.$inferSelect;

/** What creating a ruleset needs to be told */
export interface NewRuleset {
  id: string;
  ownerAccountId: string;
  name: string;
  schemaVersion: number;
  /** The `Configuration` as JSON text — serialised by the Kernel, never by this layer */
  data: string;
  /** Epoch milliseconds; passed in rather than read from the clock so a caller can be deterministic */
  now: number;
}

/**
 * Why a write did or did not happen
 *
 * Three answers rather than a nullable row, because the caller owes the User three different
 * things: the new state, a **conflict they can resolve** (v3 Req 33.8 — never a silent loss), and
 * a 404. Collapsing the last two into `null` would make RUL-02 do a second read to tell them apart.
 */
export const WRITE_OUTCOME = {
  WRITTEN: 'written',
  /** Someone else saved in between; the caller's base revision is behind */
  STALE: 'stale',
  /** No such ruleset */
  MISSING: 'missing',
} as const;

export type RulesetWriteResult =
  | { outcome: typeof WRITE_OUTCOME.WRITTEN; row: RulesetRow }
  | { outcome: typeof WRITE_OUTCOME.STALE; current: RulesetRow }
  | { outcome: typeof WRITE_OUTCOME.MISSING };

/**
 * Store a new ruleset at revision 1
 *
 * @param database The connection
 * @param input What to store
 * @returns The stored row
 */
export function insertRuleset(database: Database, input: NewRuleset): RulesetRow {
  return database.db
    .insert(ruleset)
    .values({
      id: input.id,
      ownerAccountId: input.ownerAccountId,
      name: input.name,
      schemaVersion: input.schemaVersion,
      revision: 1,
      data: input.data,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .get();
}

/**
 * One ruleset by id
 *
 * @param database The connection
 * @param id Which one
 * @returns The row, or `null` when there is none
 */
export function findRuleset(database: Database, id: string): RulesetRow | null {
  return database.db.select().from(ruleset).where(eq(ruleset.id, id)).get() ?? null;
}

/**
 * Replace a ruleset's document, if nobody else has since the caller read it
 *
 * **The revision check and the increment are one statement**, deliberately (v3 Req 33.6). A handler
 * that read the revision, compared it, and then wrote would be a race even in a single process,
 * because two requests interleave at every `await` between the read and the write. Here the `WHERE`
 * clause carries the comparison, so the loser of a race updates **zero rows** — and SQLite runs
 * that statement under the write lock, so this holds across processes and not merely within one.
 *
 * The second read only happens on the failure path, and only to tell *stale* from *missing*.
 *
 * @param database The connection
 * @param id Which ruleset
 * @param baseRevision What the caller believed it was
 * @param data The new document as JSON text
 * @param now Epoch milliseconds
 * @returns What happened, and the row the caller needs to act on it
 */
export function updateRulesetData(
  database: Database,
  id: string,
  baseRevision: number,
  data: string,
  now: number
): RulesetWriteResult {
  const row = database.db
    .update(ruleset)
    .set({ data, revision: baseRevision + 1, updatedAt: now })
    .where(and(eq(ruleset.id, id), eq(ruleset.revision, baseRevision)))
    .returning()
    .get();

  if (row) return { outcome: WRITE_OUTCOME.WRITTEN, row };

  const current = findRuleset(database, id);

  return current ? { outcome: WRITE_OUTCOME.STALE, current } : { outcome: WRITE_OUTCOME.MISSING };
}
