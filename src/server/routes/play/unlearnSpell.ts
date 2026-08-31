/**
 * `POST /api/characters/:id/unlearn-spell` — lock one spell back up (TICKET-SPL-02)
 *
 * {@link learnSpell}'s counterpart, and the rule it calls
 * ([`removeLearnedSpell`](../../../shared/services/playerActions.ts)) deliberately does **not**
 * consult the Snapshot's compendium: an id naming a spell the DM force-deleted is exactly the one a
 * Player most needs to clear, so the request takes no ruleset argument at all.
 *
 * **It reads almost exactly like its twin, and that is the folder's shape rather than a copy to
 * factor out.** `fallow` reports the pair as a clone group, as it would report `equipItem` and
 * `unequipItem` if they were in the same diff: every module here is a guard, a body read and one
 * Kernel call, and `playerRules.test.ts` asserts **one module per `PLAYER_ACTION` value**, so
 * collapsing two into one would fail a test that exists on purpose. The thirteen shared lines are
 * the convention; the one line that differs is the whole content.
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1; v4 systems/13 gap 2**
 */

import { removeLearnedSpell } from '#shared/services/playerActions';
import { PLAYER_ACTION, type SpellRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const unlearnSpell = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<SpellRequest>();
  const spellId = idFrom(body?.spellId, 'spellId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(account.id, row, PLAYER_ACTION.UNLEARN_SPELL, spellId, (character) =>
    removeLearnedSpell(character, spellId)
  );
});
