/**
 * `POST /api/sessions/:id/characters` — build a character at this table (TICKET-CHAR-04)
 *
 * **Against the Snapshot, and only ever the Snapshot** (D7). The table's rules stopped changing when
 * the session began, so this is what the character is priced by — `snapshotOf` is the only way a
 * session's rules are obtained anywhere in `src/server/`, and nothing here loads the Ruleset the
 * Snapshot was taken from.
 *
 * **The Kernel does the deciding** ([D5](../../../../docs/v3.0_backend/overview.md#d5--the-engine-is-the-shared-kernel-and-the-server-is-authoritative)).
 * `characterCreationErrors` is the same function the wizard's own rules come from and
 * `buildCharacter` is what the browser's store calls, so a character made here and one made signed
 * out are the same object built by the same code. The server is authoritative and the client's
 * answer is a prediction; what makes that safe rather than merely stated is that both are reading
 * one implementation.
 *
 * **Nothing derived is accepted** (the milestone's third Definition-of-Done rule). A body carrying a
 * stat value, a level, a budget, a roll result — or `currentResourceValues`, which a *fresh*
 * character has seeded for it — is refused by name in `creationDataFrom`, not stripped.
 *
 * **Every Member may create, including the DM.** A DM plays too, and a rule that let them run a
 * table but not sit at one would be a rule about our data model rather than about tables.
 *
 * **Refused on an archived session** through the same `requireActive` every other write uses.
 *
 * **Validates: v3 Req 32.1, 32.3, 32.5, 37.2, 37.5, 40.1, 40.2, 40.3, 40.5, 45.1**
 */

import { buildCharacter, characterCreationErrors } from '#shared/services/characterCreation';
import type { CharacterCreateRequest, CharacterDocument } from '#shared/types/api';
import { requireAccount, requireMember } from '../../auth/guards';
import { badRequest, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { insertSessionCharacter } from '../../repositories/characterRepository';
import { findGameSession } from '../../repositories/gameSessionRepository';
import { creationDataFrom, toCharacterDocument } from '../characters/characterPayloads';
import { requireActive, sessionIdFrom, snapshotOf } from './sessionPayloads';

export const createCharacter = defineHandler(async (context): Promise<CharacterDocument> => {
  const sessionId = sessionIdFrom(context.url);

  // **Before the body is read**, so an anonymous caller meets a 401 rather than a 400 about their
  // JSON — `createSession`'s rule, and the reason `requireAccount` runs beside a resource guard
  const account = requireAccount(context);
  requireMember(context, sessionId);

  const row = findGameSession(sessionId);
  if (!row) throw notFound();

  requireActive(row);

  const data = creationDataFrom(await context.json<CharacterCreateRequest>());
  const snapshot = snapshotOf(row);

  const errors = characterCreationErrors(data, snapshot);

  // The first, not all of them: they are usually one mistake seen from several angles, and a
  // refusal that lists six is one nobody reads
  if (errors.length > 0) throw badRequest(errors[0]);

  const now = Date.now();

  const character = buildCharacter(data, snapshot, {
    id: crypto.randomUUID(),
    now: new Date(now).toISOString(),
  });

  const stored = insertSessionCharacter({
    id: character.id,
    sessionId,
    ownerAccountId: account.id,
    name: character.name,
    // **A plain stringify, and that is not an oversight.** A ruleset crosses this boundary through
    // `serializeConfiguration`, which translates display-form formulas back to id-resolved ones; a
    // `Character` already stores ids for everything it references — stats, skills, races,
    // archetypes (TICKET-STAT-01, TICKET-SKL-02) — so there is no display form to translate out of.
    data: JSON.stringify(character),
    now,
  });

  return toCharacterDocument(stored);
});
