/**
 * `POST /api/characters/:id/dm-unequip-item` — the DM takes a thing off (TICKET-DM-02)
 *
 * **The route that makes *remove an inventory item* true rather than half-true.** `discardBuild`
 * refuses a build the character is wearing — take it off first — so without this a DM could add to a
 * pack and could destroy what was loose in it, and could do nothing at all about the sword in
 * somebody's hand. That is why this ticket landed four inventory routes rather than the two v3 Req
 * 42.5 names: the four are one act each, and they are `PLAYER_ACTION`'s own four.
 *
 * The rule is `playerActions.ts`'s `unequipSlot`, unchanged, including its one refusal — an empty
 * slot, which is a request that would otherwise log an Event saying nothing moved.
 *
 * Taking it off *is* putting it in the Backpack: there is no second collection (TICKET-INV-06), which
 * is why nothing here stows anything.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1; Requirement 12.5**
 */

import { unequipSlot } from '#shared/services/playerActions';
import { DM_ACTION, type EquipmentSlotRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from '../play/playPayloads';

export const dmUnequipItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<EquipmentSlotRequest>();
  const equipmentSlotType = idFrom(body?.equipmentSlotType, 'equipmentSlotType');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.UNEQUIP_ITEM,
    equipmentSlotType,
    (character) => unequipSlot(character, equipmentSlotType)
  );
});
