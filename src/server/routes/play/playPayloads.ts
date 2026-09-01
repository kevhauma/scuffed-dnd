/**
 * What the ten player-action routes share (TICKET-PLY-01)
 *
 * `sessionPayloads.ts`'s counterpart for the routes a Player drives. Each route beside this one is a
 * guard, a body read and one Kernel call, because everything else they have in common is here: which
 * rules the character plays by, the two states in which a sheet takes no writes at all, and the
 * write-plus-Event that every accepted action performs.
 *
 * ## The rules come from the Snapshot, never from a Ruleset
 *
 * A session character plays by the copy pinned when the table started
 * ([D7](../../../../docs/v3.0_backend/overview.md#d7--a-game-session-plays-against-a-pinned-snapshot)),
 * and {@link snapshotOf} is the only way any module in `src/server/` obtains one. So a DM retuning
 * their ruleset on Thursday cannot make Friday's spend unaffordable.
 *
 * ## Read the body first, guard second — and that order is load-bearing
 *
 * Every route here does `requireAccount` → `await context.json()` → `requireCharacterPlayer` →
 * {@link applyPlayerAction}, which looks like the wrong order and is the only correct one. The guard
 * loads the row, `applyPlayerAction` applies the intent to *that* row's JSON and writes the result;
 * `await context.json()` is a real suspension point, so a guard placed above it would let two
 * overlapping actions from the same Player both read the pool at 30, both apply `-5`, and both write
 * 25 — one action silently lost, and two Events in the log claiming the same before and after.
 *
 * With the body read first there is **no `await` between the row read and the write**, and
 * `better-sqlite3` is synchronous, so the two requests serialise. `requireAccount` stays above the
 * body so an anonymous caller still meets a 401 rather than a 400 about their JSON — `createCharacter`'s
 * rule, which GAM-01 established for the same reason.
 *
 * ## A character at no table takes no player actions, and says so
 *
 * IO-04's uploads are owned by an Account and belong to no Game_Session, which leaves nowhere to
 * write the Event that v3 Req 41.7 asks for — the `event` table is keyed on a session and the
 * column is `NOT NULL`. Rather than write the change and quietly skip the log, these routes refuse
 * it with a **409**: the caller may read the row, nothing about their request is malformed, and what
 * refuses them is the state of the resource. That is the same status and the same reasoning
 * {@link requireActive} uses for an archived table.
 *
 * ## And since TICKET-LIVE-02, the write is also what tells the table
 *
 * {@link applyPlayerAction} writes through `events/recordEvent.ts`, which appends the Event and
 * broadcasts it to the session's room in one path. That is the whole of what LIVE-02 had to add to
 * twenty-eight routes: they already funnelled through here, so the fan-out did too.
 *
 * **Validates: v3 Req 32.5, 37.5, 41.1, 41.7, 44.4, 45.1**
 */

import { isRefusal, type PlayerActionResult } from '#shared/services/playerActions';
import type {
  BuildItemRequest,
  CharacterDocument,
  PlayerActionEvent,
  SheetAction,
} from '#shared/types/api';
import type { Character, ComposedItem } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { recordEvent } from '../../events/recordEvent';
import { badRequest, conflict, notFound } from '../../http/appError';
import type { CharacterRow } from '../../repositories/characterRepository';
import { recordPlayerAction } from '../../repositories/characterRepository';
import type { NewEvent } from '../../repositories/eventRepository';
import { findGameSession } from '../../repositories/gameSessionRepository';
import { toCharacterDocument } from '../characters/characterPayloads';
import { requireActive, snapshotOf } from '../sessions/sessionPayloads';

/**
 * The rules one character is played by, and the table they are played at
 *
 * **Exported for TICKET-ROLL-07**, which is a second kind of act at the same table — the two states
 * a sheet takes no writes in are the same two a roll cannot happen in, and answering that question
 * twice is how they would come to differ.
 *
 * @param row The character being written to
 * @returns Its table's id and the Snapshot that table plays against
 * @throws {AppError} 409 when the character sits at no table or its table has been archived
 */
export function playedAt(row: CharacterRow): { sessionId: string; rules: Configuration } {
  if (row.sessionId === null) {
    throw conflict(
      'This character is not at a table, so it cannot be played. Characters uploaded from a ' +
        'browser are kept as they were until they join a game.'
    );
  }

  const session = findGameSession(row.sessionId);
  // Unreachable behind a foreign key, and answered rather than thrown at: a 500 here would tell a
  // Player their sheet is broken when what happened is that their table went away
  if (!session) throw notFound();

  requireActive(session);

  return { sessionId: row.sessionId, rules: snapshotOf(session) };
}

/**
 * The player state a row is holding
 *
 * A row this server wrote is a row this server can parse, so the assertion is a statement about our
 * own storage rather than a claim about untrusted input — `toCharacterDocument`'s reasoning, at the
 * other end of the same boundary.
 */
export function playerStateOf(row: CharacterRow): Character {
  return JSON.parse(row.data) as Character;
}

/**
 * Run one player action and, if the Kernel accepts it, write it down (v3 Req 41.1, 41.7)
 *
 * **The Kernel decides and this persists** — the split D5 asks for. Nothing here knows what a spend
 * costs or where a helmet goes; `apply` is one function out of
 * [`playerActions.ts`](../../../shared/services/playerActions.ts), which is the same module
 * `characterStore` calls for a character in the browser.
 *
 * **A refusal writes nothing at all** — not the character, not the Event — because the write is the
 * last thing that happens and the throw is before it.
 *
 * **TICKET-DM-01 widened `action` to {@link SheetAction} and nothing else changed**, which is what
 * the `actor` parameter was already there for: a DM adjustment is the same operation — run a Kernel
 * rule against the stored state, persist the answer, log what moved and who moved it — and v3 Req
 * 42.6 asks for exactly the before/after pair this already records. The DM routes live in
 * `routes/dm/` and call this; the guard above them is the difference between the two, and it belongs
 * to the route rather than to the pipeline.
 *
 * @param actor Whose action this is — the Account the Event is logged against
 * @param row The character, already guarded
 * @param action Which named intent this is — the Event's `type` and the route's last path segment
 * @param target Which stat, skill, slot or item the action names
 * @param apply The Kernel function to run against the stored state
 * @returns The character as it now is
 * @throws {AppError} 400 with the Kernel's own sentence when the action is refused
 */
export function applyPlayerAction(
  actor: string,
  row: CharacterRow,
  action: SheetAction,
  target: string,
  apply: (character: Character, rules: Configuration) => PlayerActionResult
): CharacterDocument {
  const { sessionId, rules } = playedAt(row);

  const result = apply(playerStateOf(row), rules);

  if (isRefusal(result)) throw badRequest(result.refusal);

  // **One clock reading, spent three times** — the character's column, the document's own
  // `updatedAt`, and the Event's `createdAt` (TICKET-LIVE-02). A client applying the broadcast
  // Event patches `updatedAt` from its `at` and lands on the very string stored here, which is what
  // lets the adjustment log notice a live change without a second mechanism. A second `Date.now()`
  // anywhere below would break that quietly; `play.test.ts` fails if one ever appears.
  const now = Date.now();
  const updated: Character = { ...result.character, updatedAt: new Date(now).toISOString() };

  const payload: PlayerActionEvent = {
    characterId: row.id,
    action,
    target,
    before: result.before,
    after: result.after,
  };

  const event: NewEvent = {
    id: crypto.randomUUID(),
    sessionId,
    // The **owner**, which for a player action is also the caller. Spelled as the row's column
    // rather than taken as a parameter would have been correct only because every caller today
    // uses `requireCharacterPlayer` — and this function is exported, so a DM route reusing it
    // would log the wrong actor in silence.
    actorAccountId: actor,
    type: action,
    payload: JSON.stringify(payload),
    now,
  };

  const written = { characterId: row.id, data: JSON.stringify(updated), now };

  // **Through `recordEvent`, so the table is told.** Every route in `routes/play/` and `routes/dm/`
  // reaches this one line, which is why the fan-out test can enumerate them structurally rather
  // than driving all twenty-eight.
  const stored = recordEvent(event, (append) => recordPlayerAction(written, append));

  return toCharacterDocument(stored.written);
}

/** A field that has to be a non-empty string id */
export function idFrom(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`This action needs a ${field}.`);
  }

  return value;
}

/**
 * A field that has to be a list of non-empty string ids (TICKET-SKL-05)
 *
 * {@link idFrom} for the action that names several at once. **Only the shape**: whether the list is
 * too long, or names something this ruleset does not have, is the Kernel's answer — the same split
 * {@link numberFrom} draws between *is this a number* and *is this number allowed*.
 */
export function idListFrom(value: unknown, field: string): string[] {
  const isList = Array.isArray(value) && value.every((id) => typeof id === 'string' && id !== '');

  if (!isList) throw badRequest(`${field} has to be a list of ids.`);

  return value as string[];
}

/**
 * The four part links of a build, as far as a body may state them (TICKET-INV-06)
 *
 * **Here rather than in `buildItem.ts`, since TICKET-DM-02** gave the act a second route: a DM
 * builds through `dm-build-item` and a Player through `build-item`, and the two read one body. A
 * private copy in each would have been `fallow`'s duplication finding and, worse, two places for
 * *what may be in a build request* to drift.
 *
 * Absent is left absent rather than written as an explicit `undefined`, so the record the Kernel is
 * handed is the record that gets stored: an unsocketed build carries no `inlayId` key at all, which
 * is what `ComposedItem` means by an empty socket. Present-but-wrong is a 400 about the field.
 *
 * **Shape only**, this module's standing split: whether tier 10 is a rung the family actually has is
 * the Kernel's answer, because that is a question about the ruleset.
 */
export function partsFrom(body: BuildItemRequest | null): Omit<ComposedItem, 'id' | 'templateId'> {
  return {
    ...(body?.materialId === undefined
      ? {}
      : { materialId: idFrom(body.materialId, 'materialId') }),
    ...(body?.materialLevel === undefined
      ? {}
      : { materialLevel: numberFrom(body.materialLevel, 'materialLevel') }),
    ...(body?.inlayId === undefined ? {} : { inlayId: idFrom(body.inlayId, 'inlayId') }),
    ...(body?.inlayLevel === undefined
      ? {}
      : { inlayLevel: numberFrom(body.inlayLevel, 'inlayLevel') }),
  };
}

/**
 * A field that has to be a real number
 *
 * **Checked here rather than left to the Kernel**, for `characterPayloads`' reason: a `NaN` reaching
 * `setResourceValue` would be reported as though the *ruleset* could not price something, which
 * sends the reader looking in the wrong place. What the Kernel owns is whether the number is
 * *allowed*; what this owns is whether it is a number.
 */
export function numberFrom(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw badRequest(`${field} has to be a number.`);
  }

  return value;
}
