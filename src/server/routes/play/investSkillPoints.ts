/**
 * `POST /api/characters/:id/invest-skill-points` — spend points on one skill (TICKET-PLY-01)
 *
 * {@link investStatPoints}'s counterpart, and **budgeted against the Snapshot since
 * TICKET-RES-05**: the pool the sheet prices covers stat points and skill points together, so this
 * hands the session's rules to the same Kernel rule the stat route calls rather than checking the
 * shape of a number and nothing else.
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1; v4 systems/02 gap 3**
 */

import { investInSkill } from '#shared/services/playerActions';
import { PLAYER_ACTION, type SkillPointsRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, numberFrom } from './playPayloads';

export const investSkillPoints = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<SkillPointsRequest>();
  const skillId = idFrom(body?.skillId, 'skillId');
  const points = numberFrom(body?.points, 'points');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.INVEST_SKILL_POINTS,
    skillId,
    (character, rules) => investInSkill(character, rules, skillId, points)
  );
});
