/**
 * `POST /api/characters/:id/dm-revoke-passive` — take a passive ability back (TICKET-PAS-01)
 *
 * {@link dmGrantPassive}'s counterpart, and the pair exists rather than one `dm-set-passives`
 * carrying the whole list for a reason that shows up here: **the Kernel rule behind this route takes
 * no ruleset.** A passive the User force-deleted is exactly the id most in need of removing, and a
 * whole-list write would have to validate every id it was handed — refusing the very edit that
 * clears the stale one. `unlearn-spell` is the same shape for the same reason.
 *
 * The Event's `before`/`after` are the id → `null`, and `target` is the passive, so the log reads
 * as the mirror of the grant.
 *
 * **Validates: v3 Req 42.6, 45.1; v4 systems/14**
 */

import { removeHeldPassive } from '#shared/services/dmActions';
import { DM_ACTION, type PassiveRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from '../play/playPayloads';

export const dmRevokePassive = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<PassiveRequest>();
  const passiveId = idFrom(body?.passiveId, 'passiveId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  // No ruleset reaches the rule — see the header. `applyPlayerAction` still supplies one; this
  // callback simply does not name it, which is what keeps the stale-id case clearable.
  return applyPlayerAction(account.id, row, DM_ACTION.REVOKE_PASSIVE, passiveId, (character) =>
    removeHeldPassive(character, passiveId)
  );
});
