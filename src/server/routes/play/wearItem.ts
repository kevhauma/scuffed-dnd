/**
 * `POST /api/characters/:id/wear-item` — move an item out of the pack and into a slot (TICKET-PLY-01)
 *
 * A slot holds one item, so whatever was in it swaps back into the pack rather than vanishing — the
 * Kernel's rule, and the reason this is not *unequip then equip* from the client: two requests could
 * land half-applied and leave a Player holding neither.
 *
 * **Validates: v3 Req 41.4, 45.1; Requirements 12.3, 12.6**
 */

import { moveItemToEquipment } from '#shared/services/playerActions';
import { type ItemPlacementRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const wearItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemPlacementRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.WEAR_ITEM,
    equipmentSlotType,
    (character, rules) => moveItemToEquipment(character, rules, itemId, equipmentSlotType)
  );
});
