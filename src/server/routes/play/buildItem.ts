/**
 * `POST /api/characters/:id/build-item` — build one thing out of its three parts (TICKET-INV-06)
 *
 * The sheet's *Item selecter* as a request: a template, a material tier, and optionally a gem tier.
 * Every one of those picks is checked by `composeBuild` in the Kernel — the same call the browser's
 * picker makes — so a triple the app would not let a Player assemble is one this refuses, in the same
 * sentence (v3 Req 41.5, D5).
 *
 * **`take-item.ts` renamed with its action.** This was *put a template in the pack*; it is *build a
 * template, a material tier and an optional gem tier into one thing*, which is a different act, so
 * keeping the old path would have left two kinds of `event` row sharing one `type` string — the exact
 * thing retiring `wear-item` and `stow-item` was for. See `PLAYER_ACTION`.
 *
 * **This route reads shape and nothing else.** Whether `materialLevel` is *a number* is answered
 * here; whether tier 10 is a rung the family actually has is answered by the rule, because that is a
 * question about the ruleset (`playPayloads`' standing split).
 *
 * The build's identity is minted **here**, on the server, for the reason `createCharacter` mints a
 * character's: the Kernel rule is pure and takes the whole record as an argument, so each root
 * supplies its own. The client's optimistic id is discarded along with the rest of its guess when the
 * response replaces the character.
 *
 * **`partsFrom` moved to `playPayloads.ts` at TICKET-DM-02**, which gave the act a second route: a
 * DM builds into somebody's pack through `dm-build-item`, and one body reader serves both.
 *
 * **Validates: v3 Req 41.4, 41.5, 45.1; Requirement 12.2; v4 systems/12**
 */

import { composeBuild } from '#shared/services/playerActions';
import { type BuildItemRequest, PLAYER_ACTION } from '#shared/types/api';
import type { ComposedItem } from '#shared/types/character';
import { requireAccount, requireCharacterPlayer } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, partsFrom } from './playPayloads';

export const buildItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<BuildItemRequest>();
  const itemId = idFrom(body?.itemId, 'itemId');
  const parts = partsFrom(body);

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const row = requireCharacterPlayer(context, characterIdFrom(context.url));

  return applyPlayerAction(
    account.id,
    row,
    PLAYER_ACTION.BUILD_ITEM,
    itemId,
    (character, rules) => {
      const built: ComposedItem = { id: crypto.randomUUID(), templateId: itemId, ...parts };

      return composeBuild(character, rules, built);
    }
  );
});
