/**
 * `POST /api/characters/:id/equip-item` — put an item in a slot (TICKET-PLY-01)
 *
 * Requirement 12.3's fit rule, decided by the Kernel against the **Snapshot**: an item goes in the
 * slot type it declares and no other, an item with no slot type fits nowhere, and a slot the
 * Snapshot does not define is not a slot at all.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.3**
 */

import { equipToSlot } from '#shared/services/playerActions';
import { type ItemPlacementRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const equipItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemPlacementRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.EQUIP_ITEM,
    equipmentSlotType,
    (character, rules) => equipToSlot(character, rules, equipmentSlotType, itemId)
  );
});
