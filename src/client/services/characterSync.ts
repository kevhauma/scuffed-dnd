/**
 * Where a new character goes, given which ruleset is open (TICKET-CHAR-04)
 *
 * `rulesetSync.ts`'s counterpart for the other thing that has two homes, and it is deliberately the
 * **only** module that branches on `RulesetSource` for a character — the rule CLAUDE.md states as
 * *the action owns the decision to persist*, applied one aggregate over. Nothing reaches either
 * destination for a character *document*: `characterStore.createCharacterHere` calls this, and this
 * decides.
 *
 * **The roll pair is the one thing here a hook calls directly**, and it is not an exception to that
 * rule so much as outside it (TICKET-ROLL-07): a roll persists no character state, so there is no
 * store action for it to belong to, and `useRoller` reads {@link sendRoll} and
 * {@link fetchSessionRolls} the way a dozen other hooks read `apiRequest`. What it must never do is
 * write `dnd_builder_characters`, and it cannot — nothing here can.
 *
 * ## Creation, and then every write after it (TICKET-PLY-01)
 *
 * A local character is edited through `characterStore`'s actions, which write LocalStorage. A
 * **session** character's edits — spending points, moving a resource, picking up an item — go
 * through the server, and PLY-01 is what put them here beside the creation this module started as.
 *
 * Each of those is a **named intent** rather than a patch: {@link sendPlayerAction} posts to
 * `/api/characters/:id/<action>`, where the action segment is the `PLAYER_ACTION` value the store
 * asked for. Nothing derived is ever in the body — the server recomputes every number against the
 * table's Snapshot and rejects a body that claims one (the milestone's third Definition-of-Done
 * rule) — and the answer is adopted whole, because the server is authoritative and the browser's
 * arithmetic is a prediction (D5).
 *
 * ## Why the local path is not routed through here at all
 *
 * It could have been, symmetrically. It is not, because that would put the browser's creation — the
 * one that has to work with no account and no network (D6) — behind a `Promise` and a module whose
 * other branch is a request. `characterStore.createCharacter` still writes LocalStorage exactly as
 * it did in v2.0, down to the synchronous return; this is asked only when the open ruleset is a
 * table's.
 *
 * **Validates: v3 Req 40.5, 40.6**
 */

import type {
  CharacterCreateRequest,
  CharacterDocument,
  PlayerAction,
  RollRequest,
  SessionRoll,
  SessionRollListing,
} from '#shared/types/api';
import type { Character, CharacterCreationData } from '#shared/types/character';
import { ApiError, apiRequest, apiSend } from './api';

/** Where a session's own routes live — a relative path, because there is one origin (D1) */
const SESSIONS_PATH = '/api/sessions';

/** Where a character's own routes live */
const CHARACTERS_PATH = '/api/characters';

/**
 * How a roll ended (TICKET-ROLL-07)
 *
 * Tagged, like {@link CREATION_OUTCOME} and {@link ACTION_OUTCOME} beside it, rather than left as an
 * untagged `{ rolled } | { message }` narrowed by `'message' in answer` — which the review pointed
 * out is a third spelling in one file and one that breaks silently the day a wire shape grows a
 * `message` of its own.
 */
export const ROLL_OUTCOME = {
  ROLLED: 'rolled',
  /** The server refused it — a roll this game does not define, an archived table, a broken ladder */
  REFUSED: 'refused',
} as const;

/** What happened, and either the logged roll or the reason there is none */
export type RollAttempt =
  | { outcome: typeof ROLL_OUTCOME.ROLLED; rolled: SessionRoll }
  | { outcome: typeof ROLL_OUTCOME.REFUSED; message: string };

/**
 * Roll one of a character's rolls at a table (v3 Req 41.6, TICKET-ROLL-07)
 *
 * **Which roll, and nothing else.** The dice are the server's — it recomputes the character against
 * the Snapshot, throws them, appends the outcome as an Event and hands the whole chain back. A body
 * carrying a total or a die is refused by name, which is what makes *the client cannot report its
 * own result* a fact rather than a convention.
 *
 * There is deliberately **no preview**: a previewed roll that differed from the recorded one is the
 * exact failure this replaces. The button keeps showing the *pool*, which is derived rather than
 * random, and that is the whole label.
 *
 * **The answer is the log entry, not the bare outcome**, so the caller can put it straight at the
 * top of the history rather than re-reading the whole log for the one row it just made.
 *
 * @param characterId Whose roll
 * @param rollId Which roll
 * @returns What the dice did, or the reason there are none
 */
export async function sendRoll(characterId: string, rollId: string): Promise<RollAttempt> {
  try {
    const rolled = await apiSend<SessionRoll>(`${CHARACTERS_PATH}/${characterId}/roll`, 'POST', {
      rollId,
    } satisfies RollRequest);

    return { outcome: ROLL_OUTCOME.ROLLED, rolled };
  } catch (error) {
    return {
      outcome: ROLL_OUTCOME.REFUSED,
      message:
        error instanceof ApiError
          ? error.message
          : 'Could not make that roll. Check your connection and try again.',
    };
  }
}

/**
 * Read a table's roll log (v3 Req 41.6)
 *
 * Every Member's when nobody is named, which is what the route answers and what DM-04's roster will
 * render. **`rolledBy` narrows it in the query rather than in the browser**, because the log is
 * capped: filtering a table-wide window afterwards is how a Player's own rolls fall off their own
 * sheet on a busy table.
 *
 * @param sessionId Which table
 * @param rolledBy Whose rolls, or nothing for the table's
 * @returns The log, newest first
 * @throws {ApiError} As `apiRequest` does
 */
export function fetchSessionRolls(
  sessionId: string,
  rolledBy?: string
): Promise<SessionRollListing> {
  const query = rolledBy ? `?rolledBy=${encodeURIComponent(rolledBy)}` : '';

  return apiRequest<SessionRollListing>(`${SESSIONS_PATH}/${sessionId}/rolls${query}`);
}

/** How creating a character at a table ended */
export const CREATION_OUTCOME = {
  CREATED: 'created',
  /** The server refused it — the sentence is the server's, and says which rule */
  REFUSED: 'refused',
} as const;

/** What happened, and either the character or the reason */
export type CreationOutcome =
  | { outcome: typeof CREATION_OUTCOME.CREATED; character: Character }
  | { outcome: typeof CREATION_OUTCOME.REFUSED; message: string };

/**
 * Create a character at a table (v3 Req 40.5, 40.6)
 *
 * **Only the Player's choices are sent.** Everything the engine derives — stat values, level, the
 * point budget, and the resource pool a fresh character has seeded — is worked out server-side
 * against the Snapshot, and the server *rejects* a body carrying any of them rather than stripping
 * it. Sending a whole `Character` would be sending a dozen such fields.
 *
 * **The answer is the server's character, not the one the client predicted.** They should be
 * identical — both are `buildCharacter`'s, against the same Snapshot — and if they ever are not,
 * the server's is the one that counts (D5).
 *
 * @param sessionId Which table
 * @param data The Player's choices
 * @returns What happened
 */
export async function createSessionCharacter(
  sessionId: string,
  data: CharacterCreationData
): Promise<CreationOutcome> {
  const request: CharacterCreateRequest = {
    name: data.name,
    raceIds: data.raceIds,
    investedStatPoints: data.investedStatPoints,
    archetypeId: data.archetypeId,
    investedSkillPoints: data.investedSkillPoints,
  };

  try {
    const created = await apiSend<CharacterDocument>(
      `${SESSIONS_PATH}/${sessionId}/characters`,
      'POST',
      request
    );

    return { outcome: CREATION_OUTCOME.CREATED, character: created.character };
  } catch (error) {
    return {
      outcome: CREATION_OUTCOME.REFUSED,
      message:
        error instanceof ApiError
          ? error.message
          : 'Could not create that character. Check your connection and try again.',
    };
  }
}

/** How a player action ended (TICKET-PLY-01) */
export const ACTION_OUTCOME = {
  APPLIED: 'applied',
  /** The server refused it — the sentence is the server's, and names the rule */
  REFUSED: 'refused',
} as const;

/** What happened, and either the character as it now is or the reason it is unchanged */
export type ActionOutcome =
  | { outcome: typeof ACTION_OUTCOME.APPLIED; character: Character }
  | { outcome: typeof ACTION_OUTCOME.REFUSED; message: string };

/**
 * Read one character from the server (TICKET-PLY-01)
 *
 * What makes a session character's sheet reachable by URL: the document carries the `sessionId`, so
 * a caller can open the right Snapshot before calculating anything against it.
 *
 * @param characterId Which one
 * @returns The document
 * @throws {ApiError} As `apiRequest` does — a refusal, or an unreachable server
 */
export function fetchCharacter(characterId: string): Promise<CharacterDocument> {
  return apiRequest<CharacterDocument>(`${CHARACTERS_PATH}/${characterId}`);
}

/**
 * Perform one player action at a table (v3 Req 41.1)
 *
 * **Send, wait, adopt.** Optimistic updates are deliberately out of scope
 * ([the ticket's own note](../../../docs/v3.0_backend/tickets/TICKET-PLY-01-player-actions-through-the-server.md)):
 * an action is one per human decision rather than one per keystroke, and a spend that appears and
 * then un-appears is worse than one that takes eighty milliseconds.
 *
 * **A refusal carries the server's own sentence, never a summary.** The engine knows which rule was
 * broken — the budget, the fit of an item, a pool that cannot be priced — and a client that
 * flattened those into *that did not work* would be inventing a message nobody decided on.
 *
 * @param characterId Whose sheet
 * @param action Which named intent — also the last segment of the path it posts to
 * @param body What the action needs to be told
 * @returns What happened
 */
export async function sendPlayerAction(
  characterId: string,
  action: PlayerAction,
  body: unknown
): Promise<ActionOutcome> {
  try {
    const updated = await apiSend<CharacterDocument>(
      `${CHARACTERS_PATH}/${characterId}/${action}`,
      'POST',
      body
    );

    return { outcome: ACTION_OUTCOME.APPLIED, character: updated.character };
  } catch (error) {
    return {
      outcome: ACTION_OUTCOME.REFUSED,
      message:
        error instanceof ApiError
          ? error.message
          : 'Could not save that change. Check your connection and try again.',
    };
  }
}
