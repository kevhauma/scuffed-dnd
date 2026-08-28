/**
 * `POST /api/characters/:id/dm-set-level` — put a character at a level (TICKET-DM-01)
 *
 * **The one route in the app whose request body names a level, and it stores none.** The body is an
 * *instruction* — "put them at 7" — and what is written is the experience the session's Snapshot
 * prices level 7 at, read off its own `xp_thresholds` curve by the Kernel. The Event records the
 * experience before and after, because that is what changed.
 *
 * That distinction is why this is not a derived value crossing the wire (the milestone's third
 * Definition-of-Done rule): a body carrying a level as a *fact about the character* would be
 * refused, and one carrying it as a target for the server to price is the affordance
 * [D9](../../../../docs/v3.0_backend/overview.md#d9--level-stays-derived-points-to-spend-becomes-a-grant)
 * explicitly allows. The server never trusts it — it computes what it means and refuses when the
 * curve cannot say.
 *
 * **Validates: v3 Req 42.2, 42.6, 45.1**
 */

import { setLevelExperience } from '#shared/services/dmActions';
import { DM_ACTION, type LevelRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmSetLevel = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<LevelRequest>();
  const level = numberFrom(body?.level, 'level');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterDM(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.SET_LEVEL,
    WHOLE_CHARACTER,
    (character, rules) => setLevelExperience(character, rules, level)
  );
});
