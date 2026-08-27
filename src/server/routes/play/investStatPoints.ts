/**
 * `POST /api/characters/:id/invest-stat-points` — spend points on one stat (TICKET-PLY-01)
 *
 * The route the whole ticket is really about: a Player raising a stat, checked against the
 * **Snapshot** by the same `validateStatAllocation` the sheet and the creation wizard read, so a
 * client sending a spend nobody granted meets the engine rather than a second copy of its rules.
 *
 * **`requireCharacterPlayer`, not `requireCharacterWriter`** — a DM raising a player's stat is
 * TICKET-DM-01's, with its own Event type and its own audit (v3 Req 41.1, 42).
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1; Requirement 14.5**
 */

import { investInStat } from '#shared/services/playerActions';
import { PLAYER_ACTION, type StatPointsRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from './playPayloads';

export const investStatPoints = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<StatPointsRequest>();
  const statId = idFrom(body?.statId, 'statId');
  const points = numberFrom(body?.points, 'points');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.INVEST_STAT_POINTS,
    statId,
    (character, rules) => investInStat(character, rules, statId, points)
  );
});
