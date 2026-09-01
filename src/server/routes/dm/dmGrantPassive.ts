/**
 * `POST /api/characters/:id/dm-grant-passive` — hand a character a passive ability
 * (TICKET-PAS-01)
 *
 * `learnSpell`'s shape with the other guard, which is the whole difference between the two and is
 * the ticket's point: a Player unlocks their own spells, and a passive is **handed to them**. At a
 * table there is no player route to `Character.passiveIds` at all, so `requireCharacterDM` is not
 * merely the stricter of two doors — it is the only one, which is what *a Player cannot self-grant*
 * means once the character is at a session
 * ([systems/14](../../../../docs/v4.0_sheet_parity/systems/14-passives-and-reference-tables.md)).
 *
 * The Event's `target` is the passive and `before`/`after` are `null` → the id, the pair
 * `learn-spell` writes, and it reads in the log as *this ability came onto this sheet*.
 *
 * **This module exists because `dmRules.test.ts` requires one write module per `DM_ACTION` value**,
 * which is v4.0 [D2](../../../../docs/v4.0_sheet_parity/overview.md#d2--the-backend-does-not-change)'s
 * 2026-08-29 amendment working as written: a handler and a `PATTERN_ROUTES` line, no schema, no
 * migration, no socket message.
 *
 * **Validates: v3 Req 42.6, 45.1; v4 systems/14**
 */

import { addHeldPassive } from '#shared/services/dmActions';
import { DM_ACTION, type PassiveRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from '../play/playPayloads';

export const dmGrantPassive = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<PassiveRequest>();
  const passiveId = idFrom(body?.passiveId, 'passiveId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.GRANT_PASSIVE,
    passiveId,
    (character, rules) => addHeldPassive(character, rules, passiveId)
  );
});
