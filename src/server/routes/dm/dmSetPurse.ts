/**
 * `POST /api/characters/:id/dm-set-purse` — the DM writes what a Character carries (TICKET-DM-02)
 *
 * **The rule is `playerActions.ts`'s `setPurseAmount`, unchanged**, which is half of v3 Req 42.5: the
 * money a DM hands out obeys *the same Kernel rules a Player's own action obeys* — one amount in the
 * ruleset's base tier (v3 Req 43.1), fractions allowed because a tier rate may be fractional, and a
 * balance that would go **negative refused with the shortfall named** rather than clamped to nothing.
 * `dmActions.ts` gains no purse setter, for the reason it gained no resource setter.
 *
 * ## Why there is no player counterpart to refuse a Player from
 *
 * There is no `set-purse` in `routes/play/` and there never was: v3 Req 42.5 gives the purse to the
 * DM the way Req 42.1 gives them experience, so at a table this route is the *only* door and
 * `characterStore.refuseAtTable` is what a Player's own sheet meets. A local sheet still writes its
 * own purse through the Kernel directly — signed out there is no DM, and one person plays both parts.
 *
 * **Validates: v3 Req 42.5, 42.6, 43.1, 43.4, 45.1**
 */

import { setPurseAmount } from '#shared/services/playerActions';
import { DM_ACTION, type PurseRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmSetPurse = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<PurseRequest>();
  const amount = numberFrom(body?.amount, 'amount');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(account.id, row, DM_ACTION.SET_PURSE, WHOLE_CHARACTER, (character) =>
    setPurseAmount(character, amount)
  );
});
