/**
 * Where a new character goes, given which ruleset is open (TICKET-CHAR-04)
 *
 * `rulesetSync.ts`'s counterpart for the other thing that has two homes, and it is deliberately the
 * **only** module that branches on `RulesetSource` for a character — the rule CLAUDE.md states as
 * *the action owns the decision to persist*, applied one aggregate over. A component never reaches
 * either destination; `characterStore.createCharacterHere` calls this, and this decides.
 *
 * ## Why it is only creation
 *
 * A local character is edited through `characterStore`'s actions, which write LocalStorage. A
 * **session** character's edits — spending points, moving a resource, picking up an item — go
 * through the server with a revision guard, and that is TICKET-PLY-01's, not this ticket's. So
 * there is exactly one write here, and no `saveCharacter` beside it pretending otherwise: an
 * unfinished half of a pair is worse than an obviously absent one, because the first thing a reader
 * does with it is call it.
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

import type { CharacterCreateRequest, CharacterDocument } from '#shared/types/api';
import type { Character, CharacterCreationData } from '#shared/types/character';
import { ApiError, apiSend } from './api';

/** Where a session's own routes live — a relative path, because there is one origin (D1) */
const SESSIONS_PATH = '/api/sessions';

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
