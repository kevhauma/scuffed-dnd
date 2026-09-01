/**
 * `POST /api/characters/:id/dm-adjust-resource` — the DM moves a pool by a delta (TICKET-DM-03)
 *
 * [`dmSetResource`](./dmSetResource.ts)'s counterpart, and the pair exists for the reason
 * [`dmAdjustPurse`](./dmAdjustPurse.ts) sits beside `dmSetPurse`: *take 7 off them* and *set their
 * pool to 23* are different instructions, and expressing the first as the second means the surface
 * doing arithmetic on a number it read a moment ago. A delta applied server-side is the same seven
 * points off whatever the pool turned out to be, which is what a table means when somebody takes
 * damage.
 *
 * ## The route TICKET-DM-03's own overview line said it would not add
 *
 * That line — *every action is a shortcut to a DM-01/DM-02 route and adds no server surface* — is
 * amended in the same change that broke it, because the principle it was protecting survives and the
 * sentence did not. **The rule is `adjustResourceValue` from `playerActions.ts`, unchanged**: the
 * identical function `routes/play/adjustResource.ts` calls, exactly as `dm-set-resource` calls the
 * identical `setResourceValue`. v3 Req 49.3 forbids *a mechanism only a quick action can reach* — a
 * private validation that drifts from the sheet's — and a second caller of a rule that already exists
 * is the opposite of one. The alternative was a DM quick action computing `current − 7` in the
 * browser, which puts back the stale read the Player's own `adjust-resource` route exists to avoid
 * and which the purse settled three tickets ago.
 *
 * What differs from `routes/play/adjustResource.ts` is the guard and the Event type, and that is all
 * that should: *who* did it and *that it was a DM* are the two facts a Player reading their own
 * history needs, and neither is a rule about pools.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1, 49.3, 49.4; Requirements 14.3, 14.4**
 */

import { adjustResourceValue } from '#shared/services/playerActions';
import { DM_ACTION, type ResourceDeltaRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from '../play/playPayloads';

export const dmAdjustResource = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ResourceDeltaRequest>();
  const statId = idFrom(body?.statId, 'statId');
  const delta = numberFrom(body?.delta, 'delta');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(account.id, row, DM_ACTION.ADJUST_RESOURCE, statId, (character, rules) =>
    adjustResourceValue(character, rules, statId, delta)
  );
});
