/**
 * `POST /api/characters/:id/dm-set-resource` — the DM writes where a pool stands (TICKET-DM-01)
 *
 * **The rule is `playerActions.ts`'s `setResourceValue`, unchanged**, which is v3 Req 42.5 in one
 * line: a DM setting a pool obeys *the same Kernel rules a Player's own action obeys* — clamped at
 * the derived maximum, open below zero so a table tracking somebody bleeding out has somewhere to
 * put it. Importing the DM's own copy of that rule would be the second implementation D5 exists to
 * prevent, so there isn't one; `dmActions.ts` says so where a reader would look for it.
 *
 * What differs from `routes/play/setResource.ts` is the guard and the Event type, and that is all
 * that should: *who* did it and *that it was a DM* are the two facts a Player reading their own
 * history needs, and neither is a rule about pools.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1; Requirements 14.3, 14.4**
 */

import { setResourceValue } from '#shared/services/playerActions';
import { DM_ACTION, type ResourceValueRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from '../play/playPayloads';

export const dmSetResource = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ResourceValueRequest>();
  const statId = idFrom(body?.statId, 'statId');
  const value = numberFrom(body?.value, 'value');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterDM(context, characterIdFrom(context.url));

  return applyPlayerAction(account.id, row, DM_ACTION.SET_RESOURCE, statId, (character, rules) =>
    setResourceValue(character, rules, statId, value)
  );
});
