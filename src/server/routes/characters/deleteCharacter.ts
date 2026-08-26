/**
 * `DELETE /api/characters/:id` — throw away a character that sits at no table (v3 Req 40.8)
 *
 * **Only an unseated one, and the narrowness is the ticket's own decision.** A character at a table
 * is part of the campaign's history: TICKET-GAM-04 settled that a departing player's are *retained*
 * rather than deleted, and who may delete one of those — and whether the Event log tolerates a row
 * it references going away — is a question worth its own ticket rather than a flag here. So a
 * session character is refused with a **409** that says where it lives, because the caller may be
 * its owner and is not doing anything malformed; what refuses them is what the character *is*.
 *
 * **Guarded by `requireCharacterWriter`**, which for a row at no table means the owner and nobody
 * else — the rule falls out of the guard rather than being restated here (v3 Req 32.4).
 *
 * **Answers 204 for a row that was already gone**, matching `revokeInvite`: the caller asked for
 * that character not to be there, and afterwards it is not. The guard has already established it
 * was theirs, so this is not a way to probe for ids.
 *
 * **Validates: v3 Req 32.1, 32.4, 32.5, 40.8**
 */

import { requireCharacterWriter } from '../../auth/guards';
import { conflict } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { removeCharacter } from '../../repositories/characterRepository';
import { characterIdFrom } from './characterPayloads';

export const deleteCharacter = defineHandler((context): undefined => {
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterWriter(context, characterId);

  if (row.sessionId !== null) {
    throw conflict(
      'That character is at a table, and a character at a table is part of the game. Leaving the ' +
        'session keeps it there for the others to read.'
    );
  }

  removeCharacter(characterId);

  // Nothing to say — the pipeline turns `undefined` into a 204
  return undefined;
});
