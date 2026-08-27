/**
 * `POST /api/characters/:id/reset-resource` — fill a pool to its maximum (TICKET-PLY-01)
 *
 * Concept 20's "regain mana to full". The maximum is derived from the Snapshot, so this is the one
 * player action whose *destination* the client could not compute for itself without being trusted
 * with a number the engine owns.
 *
 * **Validates: v3 Req 41.3, 45.1; Requirement 14.3**
 */

import { resetResourceToMax } from '#shared/services/playerActions';
import { PLAYER_ACTION, type ResourceRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const resetResource = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ResourceRequest>();
  const statId = idFrom(body?.statId, 'statId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.RESET_RESOURCE,
    statId,
    (character, rules) => resetResourceToMax(character, rules, statId)
  );
});
