/**
 * `POST /api/characters/:id/unequip-item` — take a slot's occupant off (TICKET-PLY-01)
 *
 * Distinct from {@link stowItem}, which keeps it: taking a helmet off and putting it in the pack are
 * two different things to do with a helmet, and the Event log says which one happened.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirement 12.3**
 */

import { emptySlot } from '#shared/services/playerActions';
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
    (character) => emptySlot(character, equipmentSlotType)
  );
});
