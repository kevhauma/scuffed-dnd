/**
 * Every query that touches a `character` row (TICKET-AUTH-03)
 *
 * **One read, for one guard.** `requireCharacterWriter` needs the row to decide who may write to it
 * (v3 Req 32.4: the owner, or the DM of the session it belongs to) and the handler needs the same
 * row afterwards, so the guard hands it back rather than making the handler fetch it twice.
 *
 * TICKET-PLY-01 brings the player-state write with its `revision` guard, and TICKET-DM-01/DM-02
 * bring the DM's edits. Each arrives with its own route and its own refusal tests; drafting them
 * here would be drafting against imagined handlers.
 *
 * **{@link insertCharacter} arrived with TICKET-IO-04 rather than with CHAR-04**, because the upload
 * is the first thing that creates a character on the server — one per stored Character, at no table
 * (v3 Req 36.5). CHAR-04's create runs *against a Snapshot* and will supply a `sessionId`; the
 * statement is the same one, which is why it is written once here rather than twice.
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

/** What creating a character at no table needs to be told (TICKET-IO-04) */
export interface NewUnseatedCharacter {
  id: string;
  ownerAccountId: string;
  name: string;
  /** The player state as JSON text — serialised by the caller, never by this layer (D4) */
  data: string;
  /** Epoch milliseconds; passed in rather than read from the clock so a caller can be deterministic */
  now: number;
}

/**
 * Store a character that belongs to an Account and sits at no table (v3 Req 36.5)
 *
 * The uploaded case, named rather than spelled `sessionId: null` at the call site — and the naming
 * is load-bearing twice over. It says *at no table* in the vocabulary the schema uses, so a reader
 * does not have to work out what a null means; and it keeps the word `sessionId` out of a request
 * handler, which `routes/routeGuards.test.ts` reads as *this route names a session and had better
 * guard it*. That detector is a text scan over handler modules and it is right to be blunt: the one
 * thing worse than it flagging this would be it learning enough exceptions to miss a real one.
 *
 * **One function, not a private general one behind it.** The first draft had an `insertCharacter`
 * taking a nullable `sessionId` that only this could call — a shape built for TICKET-CHAR-04, which
 * does not exist yet, and exactly the option-nothing-passes the conventions rule out. CHAR-04 splits
 * it when it has a real session to pass.
 *
 * @param input What to store, minus the session it does not have
 * @param database The connection; defaults to the process's
 * @returns The stored row
 */
export function insertUnseatedCharacter(
  input: NewUnseatedCharacter,
  database: Database = getDatabase()
): CharacterRow {
  return database.db
    .insert(character)
    .values({
      id: input.id,
      sessionId: null,
      ownerAccountId: input.ownerAccountId,
      name: input.name,
      revision: 1,
      data: input.data,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .returning()
    .get();
}
