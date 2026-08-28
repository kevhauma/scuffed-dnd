/**
 * `POST /api/characters/:id/dm-deduct-experience` — the DM takes experience away (TICKET-DM-01)
 *
 * **A deduction below zero is refused, not clamped** — the rule v1.0's sheet already had, now on the
 * server where a request rather than a disabled button is what arrives. The Kernel owns it, so the
 * browser's own sheet and this refuse identically and with the same sentence.
 *
 * Its own route rather than a signed `amount` on the award, for `PLAYER_ACTION`'s reason: the path,
 * the Event type and the client call are one spelling of what happened, and *awarded −300* is not
 * how anybody at a table describes taking experience back.
 *
 * **Validates: v3 Req 42.1, 42.6, 45.1**
 */

import { removeExperience } from '#shared/services/dmActions';
import { DM_ACTION, type ExperienceRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmDeductExperience = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ExperienceRequest>();
  const amount = numberFrom(body?.amount, 'amount');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterDM(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.DEDUCT_EXPERIENCE,
    WHOLE_CHARACTER,
    (character) => removeExperience(character, amount)
  );
});
