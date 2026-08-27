/**
 * `POST /api/characters/:id/adjust-resource` — move a pool by a delta (TICKET-PLY-01)
 *
 * Concept 20's quick entry — `-7` off a pool of 30 leaves 23 — and it is a **separate intent** from
 * setting a value rather than a client computing the sum and sending it: a delta applied server-side
 * is the same seven points off whatever the pool turned out to be, which is what a table means when
 * somebody takes damage.
 *
 * **Validates: v3 Req 41.3, 45.1; Requirements 14.3, 14.4**
 */

import { adjustResourceValue } from '#shared/services/playerActions';
import { PLAYER_ACTION, type ResourceDeltaRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from './playPayloads';

export const adjustResource = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ResourceDeltaRequest>();
  const statId = idFrom(body?.statId, 'statId');
  const delta = numberFrom(body?.delta, 'delta');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.ADJUST_RESOURCE,
    statId,
    (character, rules) => adjustResourceValue(character, rules, statId, delta)
  );
});
