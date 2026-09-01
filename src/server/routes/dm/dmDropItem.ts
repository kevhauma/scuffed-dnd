/**
 * `POST /api/characters/:id/dm-drop-item` — the DM takes a thing away for good (TICKET-DM-02)
 *
 * [`dmBuildItem`](./dmBuildItem.ts)'s counterpart at the other end of a build's life, and the *remove*
 * half of v3 Req 42.5. The rule is `playerActions.ts`'s `discardBuild`, unchanged, so the DM meets the
 * Player's own two refusals: a build this character does not hold, and one they are **wearing** —
 * take it off first, which is [`dmUnequipItem`](./dmUnequipItem.ts) and is why that route exists.
 *
 * **`itemId` is a `ComposedItem.id`, not a template's.** One build goes and its twin is left alone,
 * which is TICKET-INV-05's answer to a question the old catalog-id pack could not ask.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1; Requirement 12.6**
 */

import { discardBuild } from '#shared/services/playerActions';
import { DM_ACTION, type ItemRequest } from '#shared/types/api';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom } from '../play/playPayloads';

export const dmDropItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<ItemRequest>();
  const itemId = idFrom(body?.itemId, 'itemId');

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(account.id, row, DM_ACTION.DROP_ITEM, itemId, (character, rules) =>
    discardBuild(character, rules, itemId)
  );
});
