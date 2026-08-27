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

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { type Database, getDatabase } from '../db/client';
import { character } from '../db/schema';
import { appendEventWithin, type NewEvent } from './eventRepository';

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
  /**
   * The Ruleset it was built against (TICKET-CHAR-04)
   *
   * A real column since migration 0005, so deleting that ruleset takes the character with it. The
   * id is also inside `data.configurationId`, and that copy is the *document's* business — the
   * server may not query on it (D4), which is why leaving it as the only record left uploaded rows
   * behind forever.
   */
  rulesetId: string;
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
 * did not exist yet, and exactly the option-nothing-passes the conventions rule out. **CHAR-04 did
 * not split it either**: it added {@link insertSessionCharacter} beside this one, because the two
 * differ in more than a nullable field — this names a `ruleset_id` and that names a `session_id`,
 * and exactly one of the pair is ever set.
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
      rulesetId: input.rulesetId,
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

/** What creating a character **at a table** needs to be told (TICKET-CHAR-04) */
export interface NewSessionCharacter {
  id: string;
  /** The table it plays at; its rules are that table's pinned Snapshot, never a ruleset */
  sessionId: string;
  ownerAccountId: string;
  name: string;
  /** The player state as JSON text — serialised by the caller, never by this layer (D4) */
  data: string;
  /** Epoch milliseconds */
  now: number;
}

/**
 * Store a character built against a session's Snapshot (v3 Req 40.1)
 *
 * The counterpart to {@link insertUnseatedCharacter}, and the pair is the whole of what a character
 * can belong to: a table, or a ruleset on an Account. `ruleset_id` is **null** here deliberately —
 * a session character plays by the Snapshot, so pointing it at the ruleset the Snapshot was taken
 * from would give it a second set of rules and a cascade that could delete it mid-campaign.
 *
 * @param input What to store
 * @param database The connection; defaults to the process's
 * @returns The stored row
 */
export function insertSessionCharacter(
  input: NewSessionCharacter,
  database: Database = getDatabase()
): CharacterRow {
  return database.db
    .insert(character)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      rulesetId: null,
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

/**
 * The characters an Account has that sit at **no** table (v3 Req 40.7)
 *
 * IO-04's uploads, which until CHAR-04 had no route that could see them at all — they were written,
 * counted once in the upload's answer, and then invisible. That is what the ticket calls *not
 * silently invisible*: they are somebody's characters, they are readable, and the surface that
 * lists them says in words that they are at no table.
 *
 * @param accountId Whose
 * @param database The connection; defaults to the process's
 * @returns The rows, newest first
 */
export function listUnseatedCharacters(
  accountId: string,
  database: Database = getDatabase()
): CharacterRow[] {
  return database.db
    .select()
    .from(character)
    .where(and(eq(character.ownerAccountId, accountId), isNull(character.sessionId)))
    .orderBy(desc(character.createdAt))
    .all();
}

/** What recording one accepted player action needs to be told (TICKET-PLY-01) */
export interface PlayerActionWrite {
  characterId: string;
  /** The player state as JSON text — serialised by the caller, never by this layer (D4) */
  data: string;
  /** Epoch milliseconds */
  now: number;
  /** The Event to append beside it, minus the id the caller has already minted */
  event: NewEvent;
}

/**
 * Write a character's new player state and its Event, together or not at all (v3 Req 41.7)
 *
 * **One transaction, and that is the whole reason this function exists** rather than a route calling
 * an update and then `appendEvent`. GAM-01's review found the Snapshot write and its Event split
 * across two, and the failure it leaves behind is the worst kind: a character that changed with
 * nothing in the log saying so, which LIVE-02 fans out as silence and DM-01's audit cannot explain.
 *
 * **There is no revision guard here, deliberately.** A ruleset save states the base revision it is
 * replacing because it carries a whole document; a player action carries an *intent* which the route
 * has already applied to the row as it stands, so there is nothing a stale client could overwrite.
 * `revision` is incremented so a reader can tell whether what it holds is current.
 *
 * @param input The new state and the Event that explains it
 * @param database The connection; defaults to the process's
 * @returns The stored row, at its new revision
 */
export function recordPlayerAction(
  input: PlayerActionWrite,
  database: Database = getDatabase()
): CharacterRow {
  return database.db.transaction(
    (tx) => {
      const row = tx
        .update(character)
        .set({ data: input.data, revision: sql`${character.revision} + 1`, updatedAt: input.now })
        .where(eq(character.id, input.characterId))
        .returning()
        .get();

      appendEventWithin(tx, input.event);

      return row;
    },
    { behavior: 'immediate' }
  );
}

/**
 * Delete one character
 *
 * **Which characters may be deleted is the route's question, not this one's**, and the answer is
 * deliberately narrow: only one at no table. A character at a table is part of the campaign's
 * history — GAM-04 decided a departing player's are *retained* — so who may delete one of those,
 * and whether the Event log tolerates it, is its own ticket rather than a flag here.
 *
 * @param id Which one
 * @param database The connection; defaults to the process's
 * @returns True when a row was actually deleted
 */
export function removeCharacter(id: string, database: Database = getDatabase()): boolean {
  return database.db.delete(character).where(eq(character.id, id)).returning().all().length > 0;
}
