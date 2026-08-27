/**
 * `POST /api/characters/:id/set-resource` — write where a pool stands (TICKET-PLY-01)
 *
 * The clamp is the **Snapshot's**, applied by the Kernel: a current value may not exceed its derived
 * maximum and may go negative (Requirements 14.3, 14.4), and neither half is restated here.
 *
 * **Validates: v3 Req 41.3, 45.1; Requirements 14.3, 14.4**
 */

import { setResourceValue } from '#shared/services/playerActions';
import { PLAYER_ACTION, type ResourceValueRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from './playPayloads';

export const setResource = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ResourceValueRequest>();
  const statId = idFrom(body?.statId, 'statId');
  const value = numberFrom(body?.value, 'value');

  // The guard's row is the one applied to and written, with no `await` in between — see the note on
  // `playPayloads.ts` for the race that ordering closes
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.SET_RESOURCE,
    statId,
    (character, rules) => setResourceValue(character, rules, statId, value)
  );
});
