/**
 * `POST /api/characters/:id/dm-adjust-purse` — the DM moves a purse by a delta (TICKET-DM-02)
 *
 * [`dmSetPurse`](./dmSetPurse.ts)'s counterpart, and the pair exists for the reason `set-resource`
 * and `adjust-resource` do: *pay them 340* and *set their purse to 340* are different instructions,
 * and expressing the first as the second means the surface doing arithmetic on a number it read a
 * moment ago — which is how a payment lands on a stale balance.
 *
 * The rule is `adjustPurseBy`, which ends in `setPurseAmount`, so **a delta that would take the purse
 * below zero is refused with the shortfall named** rather than emptying it. Nothing is clamped, and
 * nothing here does the arithmetic.
 *
 * **Validates: v3 Req 42.5, 42.6, 43.4, 45.1**
 */

import { adjustPurseBy } from '#shared/services/playerActions';
import { DM_ACTION, type PurseDeltaRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmAdjustPurse = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<PurseDeltaRequest>();
  const delta = numberFrom(body?.delta, 'delta');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(account.id, row, DM_ACTION.ADJUST_PURSE, WHOLE_CHARACTER, (character) =>
    adjustPurseBy(character, delta)
  );
});
