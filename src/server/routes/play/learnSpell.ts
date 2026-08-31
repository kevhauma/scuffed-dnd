/**
 * `POST /api/characters/:id/learn-spell` — unlock one spell (TICKET-SPL-02)
 *
 * The sheet's `locked` → `Learned` flag, set by hand. Nothing gates it and nothing derives it (User
 * ruling, 2026-08-29), so the rule is short — but it is still
 * [`addLearnedSpell`](../../../shared/services/playerActions.ts)'s rather than this module's, because
 * the browser's Spellbook calls the same one for a character in LocalStorage.
 *
 * The Event's `target` is the spell, and `before`/`after` are `null` → the id: the equip/unequip
 * pair's shape, and it reads in the log as *this id came into being on this sheet*.
 *
 * **Validates: v3 Req 41.1, 41.2, 45.1; v4 systems/13 gap 2**
 */

import { addLearnedSpell } from '#shared/services/playerActions';
import { PLAYER_ACTION, type SpellRequest } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const learnSpell = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<SpellRequest>();
  const spellId = idFrom(body?.spellId, 'spellId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.LEARN_SPELL,
    spellId,
    (character, rules) => addLearnedSpell(character, rules, spellId)
  );
});
