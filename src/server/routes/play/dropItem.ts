/**
 * `POST /api/characters/:id/drop-item` — put a built item down for good (TICKET-PLY-01)
 *
 * **`itemId` is a `ComposedItem.id` since TICKET-INV-05**, and **exactly the build named goes** —
 * where this said *every copy of it goes*, because the pack was a list of catalog ids with no
 * quantities and nothing distinguished two identical entries. A build has its own identity, so two
 * ropes are two things and dropping one leaves its twin alone.
 *
 * Dropping **destroys** the record rather than merely unlisting it, and since TICKET-INV-06 that is
 * the whole of what it means: the Backpack is derived, so an unworn build is already in it and there
 * is no list to be taken out of. A build the character is **wearing** is refused rather than
 * destroyed under them — the rule and its reasoning live on `discardBuild`.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.6**
 */

import { discardBuild } from '#shared/services/playerActions';
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

  return applyPlayerAction(account.id, row, PLAYER_ACTION.DROP_ITEM, itemId, (character, rules) =>
    discardBuild(character, rules, itemId)
  );
});
