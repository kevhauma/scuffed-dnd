/**
 * Every query that touches a `ruleset` row (TICKET-DB-01)
 *
 * **Handlers call repositories; they never build SQL or touch Drizzle.** That is the layering this
 * module exists to start, and TICKET-DX-08 turns it into a dependency-cruiser rule so it stays
 * true without anyone remembering it.
 *
 * DB-01 wrote the two its own criteria needed — a document that round-trips and a revision that
 * cannot race. **TICKET-RUL-01 added the four a handler actually calls**: the owner's listing, the
 * rename, the delete, and the count of sessions standing in a delete's way.
 *
 * **Validates: v3 Req 46.3, 33.1, 33.2, 33.6**
 */

import { and, desc, eq } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { ruleset } from '../db/schema';
import { insertUnseatedCharacter, type NewUnseatedCharacter } from './characterRepository';

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
 * @param input What to store
 * @param database The connection; defaults to the process's
 * @returns The stored row
 */
export function insertRuleset(input: NewRuleset, database: Database = getDatabase()): RulesetRow {
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
 * Store a ruleset and the characters uploaded with it, or store neither (TICKET-IO-04)
 *
 * **One transaction, and the review is why it is one.** The route validated every character before
 * writing anything — its own docblock says a partial roster is unacceptable — and then wrote the
 * ruleset and looped the inserts unguarded. A failure part-way through (`SQLITE_TOOBIG`, a full
 * disk, a busy timeout) would leave the Account holding the ruleset and *some* of its characters
 * while the client was told the whole thing failed, which is the worst of both answers: the User
 * retries, and now there are two rulesets and a duplicated half-roster.
 *
 * `better-sqlite3` transactions are synchronous and run on the connection they were opened on, so
 * the statements below — issued through the same `database` — are inside this one. That is also why
 * every repository function here is sync: an `await` inside a transaction callback would commit
 * around the thing it was meant to wrap.
 *
 * @param input The ruleset, and the characters to create beside it
 * @param database The connection; defaults to the process's
 * @returns The stored ruleset row
 */
export function insertRulesetWithCharacters(
  input: { ruleset: NewRuleset; characters: NewUnseatedCharacter[] },
  database: Database = getDatabase()
): RulesetRow {
  return database.db.transaction(() => {
    const row = insertRuleset(input.ruleset, database);

    for (const uploaded of input.characters) insertUnseatedCharacter(uploaded, database);

    return row;
  });
}

/**
 * One ruleset by id
 *
 * @param id Which one
 * @param database The connection; defaults to the process's
 * @returns The row, or `null` when there is none
 */
export function findRuleset(id: string, database: Database = getDatabase()): RulesetRow | null {
  return database.db.select().from(ruleset).where(eq(ruleset.id, id)).get() ?? null;
}

/**
 * A ruleset row **without its document** (TICKET-RUL-01)
 *
 * Every column but `data`, which is the whole reason this type is written out rather than inferred
 * from the table: an `Omit<RulesetRow, 'data'>` would describe the same fields and would not stop
 * the *query* selecting the document, and it is the query that matters. 306 KB per row.
 */
export interface RulesetSummaryRow {
  id: string;
  ownerAccountId: string;
  name: string;
  schemaVersion: number;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

/** The columns a summary is, named once so the listing cannot quietly grow a `data` */
const SUMMARY_COLUMNS = {
  id: ruleset.id,
  ownerAccountId: ruleset.ownerAccountId,
  name: ruleset.name,
  schemaVersion: ruleset.schemaVersion,
  revision: ruleset.revision,
  createdAt: ruleset.createdAt,
  updatedAt: ruleset.updatedAt,
};

/**
 * What one Account owns, newest edit first (v3 Req 33.1, 33.8)
 *
 * **The `data` column is not selected**, and that is a rule rather than an optimisation
 * (TICKET-RUL-01's notes): a list endpoint that hands back whole documents invites a client that
 * renders from the list and then edits the copy it happens to hold — which is how RUL-02's revision
 * guard gets bypassed by accident rather than on purpose.
 *
 * @param ownerAccountId Whose rulesets
 * @param database The connection; defaults to the process's
 * @returns Their rulesets, most recently updated first, without their documents
 */
export function listRulesetsByOwner(
  ownerAccountId: string,
  database: Database = getDatabase()
): RulesetSummaryRow[] {
  return database.db
    .select(SUMMARY_COLUMNS)
    .from(ruleset)
    .where(eq(ruleset.ownerAccountId, ownerAccountId))
    .orderBy(desc(ruleset.updatedAt))
    .all();
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
 * @param id Which ruleset
 * @param baseRevision What the caller believed it was
 * @param data The new document as JSON text
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns What happened, and the row the caller needs to act on it
 */
export function updateRulesetData(
  id: string,
  baseRevision: number,
  data: string,
  now: number,
  database: Database = getDatabase()
): RulesetWriteResult {
  const row = database.db
    .update(ruleset)
    .set({ data, revision: baseRevision + 1, updatedAt: now })
    .where(and(eq(ruleset.id, id), eq(ruleset.revision, baseRevision)))
    .returning()
    .get();

  if (row) return { outcome: WRITE_OUTCOME.WRITTEN, row };

  const current = findRuleset(id, database);

  return current ? { outcome: WRITE_OUTCOME.STALE, current } : { outcome: WRITE_OUTCOME.MISSING };
}

/**
 * Rename a ruleset — the column **and** the document (TICKET-RUL-01, v3 Req 33.2)
 *
 * Named `updateRulesetName` rather than `renameRuleset` so it does not collide with the route
 * handler of that name: two exports sharing a spelling make an aliased import at every call site
 * and an ambiguous `export *` waiting to happen. `update…` matches {@link updateRulesetData} beside
 * it, which is the other half of the same statement.
 *
 * **Both, because the name lives in two places and a User only ever sees one of them.** The row's
 * `name` is what the listing renders; `Configuration.name` is what an export carries and what the
 * config panels put in their heading. Writing only the column would leave a ruleset called one
 * thing in the list and another thing once opened, and IO-04's export would carry the stale one.
 * The caller supplies the re-serialised document, because deciding what is *inside* it is not a
 * query (D4) and this layer does not parse one.
 *
 * It goes through the same compare-and-set as {@link updateRulesetData} and bumps `revision` for
 * the same reason: this writes `data`, so a rename that raced a document save would silently
 * discard the save. v3 Req 33.6 asks for both halves — increment on every accepted write, refuse a
 * write whose stated base revision is not the current one — and a rename is a write.
 *
 * @param id Which ruleset
 * @param baseRevision What the caller believed it was
 * @param name The new name, for the column
 * @param data The document with that name already in it, as JSON text
 * @param now Epoch milliseconds
 * @param database The connection; defaults to the process's
 * @returns What happened, and the row the caller needs to act on it
 */
export function updateRulesetName(
  id: string,
  baseRevision: number,
  name: string,
  data: string,
  now: number,
  database: Database = getDatabase()
): RulesetWriteResult {
  const row = database.db
    .update(ruleset)
    .set({ name, data, revision: baseRevision + 1, updatedAt: now })
    .where(and(eq(ruleset.id, id), eq(ruleset.revision, baseRevision)))
    .returning()
    .get();

  if (row) return { outcome: WRITE_OUTCOME.WRITTEN, row };

  const current = findRuleset(id, database);

  return current ? { outcome: WRITE_OUTCOME.STALE, current } : { outcome: WRITE_OUTCOME.MISSING };
}

/**
 * Delete a ruleset (TICKET-RUL-01, v3 Req 33.2)
 *
 * **Whether the caller may, and whether a Game_Session stands in the way, are both decided above
 * this line** — the guard in `auth/guards.ts` and the count in `gameSessionRepository.ts`. What is
 * left here is the statement, and the one thing worth saying about it is what it does *not* do: a
 * session created from this ruleset keeps playing, because `game_session.ruleset_id` is
 * `ON DELETE SET NULL` and the Snapshot is a copy (D7). The game loses its provenance, not its
 * rules.
 *
 * @param id Which ruleset
 * @param database The connection; defaults to the process's
 * @returns True when a row went, false when there was none
 */
export function removeRuleset(id: string, database: Database = getDatabase()): boolean {
  return database.db.delete(ruleset).where(eq(ruleset.id, id)).returning().all().length > 0;
}
