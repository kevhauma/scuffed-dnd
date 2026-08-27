/**
 * `POST /api/characters/:id/invest-skill-points` — spend points on one skill (TICKET-PLY-01)
 *
 * {@link investStatPoints}'s counterpart, and deliberately **not** budgeted: the ruleset prices stat
 * points and says nothing about skill points, so the Kernel's only rule is the shape of the number.
 * Refusing here would make a sheet stricter than the wizard that produced the character.
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1**
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
    (character) => investInSkill(character, skillId, points)
  );
});
