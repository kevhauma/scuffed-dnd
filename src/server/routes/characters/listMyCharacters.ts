/**
 * `GET /api/characters` — the characters of yours that sit at no table (v3 Req 40.7)
 *
 * **IO-04's uploads finally have a surface.** That ticket wrote `character` rows with
 * `session_id IS NULL` and its own review flagged what it had left behind: nothing listed them,
 * nothing deleted them, and the cascade from `game_session` could never fire for a row at no table.
 * They were counted once in the upload's answer and then invisible. This route is the *readable*
 * half of closing that; the `ruleset_id` column added in migration 0005 is the *deletable* half.
 *
 * **Scoped by the caller, so there is no id to guard** — `listRulesets` and `listSessions` are the
 * precedent, and the scoping is the repository's `WHERE owner_account_id = ?` rather than a filter
 * applied after a broader read.
 *
 * **Deliberately only the unseated ones.** A character at a table is read through that table
 * (`GET /api/sessions/:id/characters`), where the answer includes the other players' — and a
 * combined *everything of mine everywhere* list would be a fourth way to reach a session character
 * with a fourth set of visibility rules to keep in step.
 *
 * **Validates: v3 Req 32.1, 36.5, 40.7**
 */

import type { CharacterListing } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { listUnseatedCharacters } from '../../repositories/characterRepository';
import { toCharacterDocument } from './characterPayloads';

export const listMyCharacters = defineHandler((context): CharacterListing => {
  const account = requireAccount(context);

  return { characters: listUnseatedCharacters(account.id).map(toCharacterDocument) };
});
