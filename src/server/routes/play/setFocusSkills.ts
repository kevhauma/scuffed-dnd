/**
 * `POST /api/characters/:id/set-focus-skills` — name the skills this character focuses on
 * (TICKET-SKL-05)
 *
 * The whole list in one request, because the multiplier is a sum over the three slots and a
 * slot-addressed write would need an empty-slot sentinel on the character to be meaningful — see
 * [`chooseFocusSkills`](../../../shared/services/playerActions.ts), which is where the rule lives and
 * which the browser's store calls for the same character in local mode.
 *
 * The Event's `target` is empty: the picks name no one stat, skill or slot the way a spend does. They
 * are the change, and `before`/`after` carry them.
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1; v4 systems/06 gap 2**
 */

import { chooseFocusSkills } from '#shared/services/playerActions';
import { type FocusSkillsRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idListFrom } from './playPayloads';

export const setFocusSkills = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<FocusSkillsRequest>();
  const focusSkillIds = idListFrom(body?.focusSkillIds, 'focusSkillIds');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.SET_FOCUS_SKILLS,
    '',
    (character, rules) => chooseFocusSkills(character, rules, focusSkillIds)
  );
});
