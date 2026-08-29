/**
 * `POST /api/characters/:id/dm-set-dream-level` — set how far a character stands in their dream
 * (TICKET-RES-04)
 *
 * **The other half of the pair `dm-set-level` is not.** That route's body is an instruction the
 * server prices into experience and stores nothing of; this one's body *is* the stored number —
 * `dreamLevel` is player state nothing derives, which is the same test that admitted `experience`
 * ([systems/02](../../../../docs/v4.0_sheet_parity/systems/02-progression-and-identity.md) gap 2).
 * The Event's before and after are dream levels, and a character who has never had one reports 1 as
 * its before, because the neutral default is the reader's rule rather than a stored backfill.
 *
 * **This module exists because `dmRules.test.ts` requires one write module per `DM_ACTION` value**,
 * not because the action needed a surface of its own: it is `dmGrantPoints`'s shape — a guard, a
 * body read, a call into `dmActions.ts` — with a different Kernel rule behind it. v4.0
 * [D2](../../../../docs/v4.0_sheet_parity/overview.md#d2--the-backend-does-not-change) says the
 * backend does not change, and its **2026-08-29 amendment** names this as the exception it allows:
 * a handler and a `PATTERN_ROUTES` line, no schema, no migration, no socket message.
 *
 * **Validates: v3 Req 42.6, 45.1; v4 systems/02 gap 2**
 */

import { setDreamLevel } from '#shared/services/dmActions';
import { DM_ACTION, type DreamLevelRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, numberFrom } from '../play/playPayloads';
import { WHOLE_CHARACTER } from './dmPayloads';

export const dmSetDreamLevel = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<DreamLevelRequest>();
  const dreamLevel = numberFrom(body?.dreamLevel, 'dreamLevel');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(
    account.id,
    row,
    DM_ACTION.SET_DREAM_LEVEL,
    WHOLE_CHARACTER,
    (character) => setDreamLevel(character, dreamLevel)
  );
});
