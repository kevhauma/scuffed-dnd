/**
 * `POST /api/characters/:id/dm-build-item` — the DM puts a thing in somebody's pack (TICKET-DM-02)
 *
 * **The rule is `playerActions.ts`'s `composeBuild`, unchanged**, and that is the whole of this
 * ticket's central note: *no DM bypass of the ruleset's own rules*. A template the Snapshot does not
 * define is refused for the DM in exactly the sentence a Player gets — *"This ruleset has no such
 * item."* — as is a metal nobody picked, a family with no such rung, and a gem named without a tier.
 * A DM who needs a thing the ruleset cannot describe changes the ruleset, because otherwise the
 * Snapshot stops describing what the table is actually playing and every derived number quietly stops
 * being trustworthy.
 *
 * **Where it lands is nowhere in particular** — the build goes into `composedItems`, which makes it
 * *not worn*, which is what the Backpack is (`backpackOf`, TICKET-INV-06). The ticket's own words are
 * *"adds an item to a player's misc storage"*; there is no such stored collection any more, and the
 * derived Backpack is what that phrase now means.
 *
 * The identity is minted here, as `routes/play/buildItem.ts` mints its own, and the body reader is
 * shared with it rather than copied.
 *
 * **Validates: v3 Req 42.5, 42.6, 45.1; Requirement 12.2; v4 systems/12**
 */

import { composeBuild } from '#shared/services/playerActions';
import { type BuildItemRequest, DM_ACTION } from '#shared/types/api';
import type { ComposedItem } from '#shared/types/character';
import { requireAccount, requireCharacterDM } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom } from '../characters/characterPayloads';
import { applyPlayerAction, idFrom, partsFrom } from '../play/playPayloads';

export const dmBuildItem = defineHandler(async (context) => {
  const account = requireAccount(context);

  const body = await context.json<BuildItemRequest>();
  const itemId = idFrom(body?.itemId, 'itemId');
  const parts = partsFrom(body);

  // Guarded after the body so no `await` sits between this read and the write — see `playPayloads`
  const characterId = characterIdFrom(context.url);
  const row = requireCharacterDM(context, characterId);

  return applyPlayerAction(account.id, row, DM_ACTION.BUILD_ITEM, itemId, (character, rules) => {
    const built: ComposedItem = { id: crypto.randomUUID(), templateId: itemId, ...parts };

    return composeBuild(character, rules, built);
  });
});
