/**
 * `POST /api/characters/:id/drop-item` — take an item out of the pack (TICKET-PLY-01)
 *
 * **Every copy of it goes**, which is v1.0's behaviour rather than a decision taken here: the pack
 * is a list of ids with no quantities, so nothing distinguishes two identical entries.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.2**
 */

import { removeFromPack } from '#shared/services/playerActions';
import { type ItemRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const dropItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemRequest>();
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(account.id, row, PLAYER_ACTION.DROP_ITEM, itemId, (character) =>
    removeFromPack(character, itemId)
  );
});
