/**
 * Every query that touches a `character` row (TICKET-AUTH-03)
 *
 * **One read, for one guard.** `requireCharacterWriter` needs the row to decide who may write to it
 * (v3 Req 32.4: the owner, or the DM of the session it belongs to) and the handler needs the same
 * row afterwards, so the guard hands it back rather than making the handler fetch it twice.
 *
 * TICKET-CHAR-04 brings create, TICKET-PLY-01 brings the player-state write with its `revision`
 * guard, and TICKET-DM-01/DM-02 bring the DM's edits. Each arrives with its own route and its own
 * refusal tests; drafting them here would be drafting against imagined handlers.
 *
 * The connection is the last parameter and defaults to the process's — see
 * [`gameSessionRepository`](./gameSessionRepository.ts) for why that shape, and why DB-01's two
 * repositories still take it first.
 *
 * **Validates: v3 Req 32.4**
 */

import { eq } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { character } from '../db/schema';

/** A character row — `data` is still JSON text (D4) */
export type CharacterRow = typeof character.$inferSelect;

/**
 * One character by id
 *
 * @param id Which one
 * @param database The connection; defaults to the process's
 * @returns The row, or `null` when there is none
 */
export function findCharacter(id: string, database: Database = getDatabase()): CharacterRow | null {
  return database.db.select().from(character).where(eq(character.id, id)).get() ?? null;
}
