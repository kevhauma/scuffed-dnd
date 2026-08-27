/**
 * `POST /api/characters/:id/stow-item` — move a slot's occupant into the pack (TICKET-PLY-01)
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.5**
 */

import { moveItemToMisc } from '#shared/services/playerActions';
import { type EquipmentSlotRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const stowItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<EquipmentSlotRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.STOW_ITEM,
    equipmentSlotType,
    (character) => moveItemToMisc(character, equipmentSlotType)
  );
});
