/**
 * `POST /api/characters/:id/dm-award-experience` — the DM awards experience (TICKET-DM-01)
 *
 * **The level is not mentioned anywhere in this route, and that is the point** (D9): experience is
 * what is stored, and `calculateCharacterLevel` reads the level back out of the ruleset's
 * `xp_thresholds` curve whenever anybody asks. A route that wrote a level would be a route that
 * could disagree with the curve.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.6, 45.1**
 */

import { addExperience } from '#shared/services/dmActions';
import { DM_ACTION, type ExperienceRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmAwardExperience = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ExperienceRequest>();
  const amount = numberFrom(body?.amount, 'amount');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterDM(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.AWARD_EXPERIENCE,
    WHOLE_CHARACTER,
    (character) => addExperience(character, amount)
  );
});
