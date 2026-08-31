/**
 * `POST /api/characters/:id/cast-spell` — spend a learned spell's mana (TICKET-SPL-02)
 *
 * A **resource spend, not a roll**: the rule
 * ([`spendSpellCost`](../../../shared/services/playerActions.ts)) ends in the same
 * `adjustResourceValue` a hand-typed deduction goes through, so server-resolved rolls are untouched
 * and no dice are involved. Whatever a spell's effect text says about rolling stays a Player-driven
 * roll on the existing roll surface.
 *
 * **The body names the pool**, because no ruleset field says which resource casting draws on (User
 * ruling, 2026-08-31). Both ids are checked for *shape* here and for *meaning* by the Kernel — the
 * split `playPayloads` draws between "is this an id" and "is this id allowed".
 *
 * The Event's `target` is the spell, and `before`/`after` are the pool's values, which is what makes
 * the log read as *casting Fireball took Mana from 190 to 40*.
 *
 * **Validates: v3 Req 41.1, 41.2, 41.5, 45.1; v4 systems/13 gap 3**
 */

import { spendSpellCost } from '#shared/services/playerActions';
import { type CastSpellRequest, PLAYER_ACTION } from '#shared/types/api';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from './playPayloads';

export const castSpell = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<CastSpellRequest>();
  const spellId = idFrom(body?.spellId, 'spellId');
  const statId = idFrom(body?.statId, 'statId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(account.id, row, PLAYER_ACTION.CAST_SPELL, spellId, (character, rules) =>
    spendSpellCost(character, rules, spellId, statId)
  );
});
