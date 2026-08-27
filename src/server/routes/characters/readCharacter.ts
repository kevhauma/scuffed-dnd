/**
 * `GET /api/characters/:id` — one character (TICKET-PLY-01)
 *
 * **What makes a sheet a page rather than a moment.** Until this existed a session character could
 * only be reached by walking `GET /api/sessions/:id/characters`, which meant the browser had to have
 * come from the session list — a reload, or a pasted link, had nothing to read. It answers the
 * document *with* its `sessionId`, which is what lets the client open the right Snapshot before it
 * calculates anything.
 *
 * **`requireCharacterWriter`, not the narrower player guard**: reading is not acting, and a DM who
 * may write to a sheet may certainly look at one. Every Member reads every character at their table
 * through `GET /api/sessions/:id/characters` (v3 Req 40.4); this is the by-id door, and it is
 * deliberately the same answer — a 404 — for a stranger's character and for an id nobody minted.
 *
 * **Validates: v3 Req 32.4, 32.5, 40.4**
 */

import type { CharacterDocument } from '#shared/types/api';
import { requireCharacterWriter } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { characterIdFrom, toCharacterDocument } from './characterPayloads';

export const readCharacter = defineHandler((context): CharacterDocument => {
  const characterId = characterIdFrom(context.url);

  return toCharacterDocument(requireCharacterWriter(context, characterId));
});
