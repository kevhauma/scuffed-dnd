/**
 * `POST /api/characters/:id/unequip-item` — take a slot's occupant off (TICKET-PLY-01)
 *
 * **The one way to empty a slot since TICKET-INV-06.** `stow-item` was the other, and the two were
 * separated only by a stored pack: one put the build in it, this one destroyed the build. With the
 * Backpack derived as everything built and not worn, taking a thing off *is* putting it in the bag,
 * so there is one act here and throwing something away is `drop-item`.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirements 12.3, 12.5**
 */

import { unequipSlot } from '#shared/services/playerActions';
import { type EquipmentSlotRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const unequipItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<EquipmentSlotRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.UNEQUIP_ITEM,
    equipmentSlotType,
    (character) => unequipSlot(character, equipmentSlotType)
  );
});
