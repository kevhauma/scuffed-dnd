/**
 * `POST /api/characters/:id/dm-grant-points` — hand out or take back spendable points
 * (TICKET-DM-01)
 *
 * **One route for both directions, unlike experience**, and the asymmetry is the shape of the two
 * fields rather than an inconsistency. Experience accumulates, so *award 300* and *deduct 300* are
 * two things that happened at a table. A grant is a standing number — *this character has three
 * extra points* — so what a DM does to it is set it, and *revoke* is setting it lower. Two routes
 * would have been two spellings of one write, and a delta would let two overlapping adjustments
 * compound into a total neither DM asked for.
 *
 * The refusal that matters is the Kernel's: revoking below what the character has already spent is
 * refused and names the overspend (v3 Req 42.4), priced through `validateStatAllocation` rather than
 * by arithmetic here.
 *
 * **Validates: v3 Req 42.3, 42.4, 42.6, 45.1**
 */

import { setGrantedPoints } from '#shared/services/dmActions';
import { DM_ACTION, type GrantRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmGrantPoints = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<GrantRequest>();
  const points = numberFrom(body?.points, 'points');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterDM(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.GRANT_POINTS,
    WHOLE_CHARACTER,
    (character, rules) => setGrantedPoints(character, rules, points)
  );
});
