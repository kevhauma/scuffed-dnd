/**
 * `POST /api/characters/:id/take-item` — put an item in the pack (TICKET-PLY-01)
 *
 * The Snapshot has to define the item, which the browser's store never checked because its own
 * picker is built from the ruleset's list. A request is not a picker.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.2**
 */

import { addToPack } from '#shared/services/playerActions';
import { type ItemRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const takeItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemRequest>();
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(account.id, row, PLAYER_ACTION.TAKE_ITEM, itemId, (character, rules) =>
    addToPack(character, rules, itemId)
  );
});
