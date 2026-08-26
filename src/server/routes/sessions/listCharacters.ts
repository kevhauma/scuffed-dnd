/**
 * `GET /api/sessions/:id/characters` — every character at this table (v3 Req 40.4)
 *
 * **Every Member reads every one, and each writes only their own.** That split is the whole of the
 * requirement, and only half of it is here: the read is open to the table because a game is played
 * out loud — a player who could not see the party's sheets would be playing a different game —
 * while the write half belongs to `requireCharacterWriter`, which TICKET-PLY-01 spends.
 *
 * **The characters of a departed Member are in this list**, deliberately (v3 Req 39.3). They stay at
 * the table when their player leaves, readable by everybody and writable by nobody, and a listing
 * that filtered them would be quietly undoing GAM-04's retention rule. The lobby is where *whose*
 * they are is answered; this is *what is at the table*.
 *
 * **Readable on an archived session**, like every other read — the sheets are most of what a
 * finished campaign was.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.5, 39.3, 40.4**
 */

import type { CharacterListing } from '#shared/types/api';
import { requireMember } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { charactersInSession } from '../../repositories/gameSessionRepository';
import { toCharacterDocument } from '../characters/characterPayloads';
import { sessionIdFrom } from './sessionPayloads';

export const listCharacters = defineHandler((context): CharacterListing => {
  const sessionId = sessionIdFrom(context.url);
  requireMember(context, sessionId);

  return { characters: charactersInSession(sessionId).map(toCharacterDocument) };
});
