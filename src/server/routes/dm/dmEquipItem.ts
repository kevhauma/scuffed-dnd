/**
 * `POST /api/characters/:id/dm-equip-item` — the DM puts a thing on somebody (TICKET-DM-02)
 *
 * **The rule is `playerActions.ts`'s `equipToSlot`, unchanged, and this is the route the ticket's
 * central note is really about**: `slotRefusal` refuses a build whose template does not declare this
 * exact slot type, and it refuses it **for the DM in the Player's own sentence** — *"Iron Battleaxe
 * does not go in that slot."* A DM who needs a helmet in a boot slot changes the ruleset, not the
 * enforcement (Requirement 12.3).
 *
 * Its other three refusals come free with the shared rule and matter as much: a slot type this
 * ruleset does not define, a template it does not define, and a build **this character does not
 * hold** — the last of which stops a request naming somebody else's axe from filling a slot with a
 * record the inventory has no entry for.
 *
 * Whatever the new occupant displaces goes back in the Backpack without anything here saying so: the
 * Backpack is everything built and not worn (TICKET-INV-06), so there is nowhere else for it to go.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1; Requirement 12.3**
 */

import { equipToSlot } from '#shared/services/playerActions';
import { DM_ACTION, type ItemPlacementRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from '../play/playPayloads';

export const dmEquipItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemPlacementRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.EQUIP_ITEM,
    equipmentSlotType,
    (character, rules) => equipToSlot(character, rules, equipmentSlotType, itemId)
  );
});
