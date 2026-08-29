/**
 * The wire ↔ row boundary for a Character (TICKET-CHAR-04)
 *
 * `sessionPayloads.ts`'s counterpart one aggregate over, and it carries the one rule this ticket
 * exists to enforce: **no derived value crosses the wire as input**.
 *
 * ## Why the refusal names the field
 *
 * The milestone's third Definition-of-Done rule says a request body carrying a stat value, a level,
 * a point budget or a roll result is *rejected*. It would have been easier to take the five fields
 * this cares about and ignore the rest — and that is the version that goes wrong quietly, because a
 * client sending `level: 4` and getting a 201 has every reason to believe the level was honoured.
 * The next thing it does is show the Player a 4, and the sheet shows a 1, and nothing anywhere
 * explains the difference. So {@link creationDataFrom} looks for the derived names and says which
 * one it found.
 *
 * **The list is of things the engine computes**, not of everything absent from the request type. A
 * stray `favouriteColour` is ignored, because it is not a claim about a rule — it is noise, and
 * refusing noise makes an API brittle for no safety.
 *
 * **Validates: v3 Req 40.2, 40.5, 45.1**
 */

import type { CharacterCreateRequest, CharacterDocument } from '#shared/types/api';
import type { Character, CharacterCreationData } from '#shared/types/character';
import { badRequest } from '../../http/appError';
import type { CharacterRow } from '../../repositories/characterRepository';

/** The collection every character id sits one segment under */
const CHARACTERS_PREFIX = '/api/characters/';

/**
 * Which character a path named
 *
 * `rulesetIdFrom`'s shape a third time — a small function per collection rather than one
 * parameterised by prefix, for the reason that one gives.
 *
 * **Two shapes are real**: `/api/characters/:id`, and — since TICKET-PLY-01 — `/api/characters/:id/
 * <action>`, where the action segment is one of `PLAYER_ACTION`'s values. Anything deeper is not a
 * route, and comes back as an empty string that the handler refuses like any other unknown id.
 *
 * @param url The request URL
 * @returns The id segment, or an empty string when the path has none
 */
export function characterIdFrom(url: URL): string {
  if (!url.pathname.startsWith(CHARACTERS_PREFIX)) return '';

  const [id, ...rest] = url.pathname.slice(CHARACTERS_PREFIX.length).split('/');

  return rest.length <= 1 ? id : '';
}

/**
 * The fields the engine derives, which a client therefore may not send
 *
 * Spelled as the names they carry on `Character` and `CalculatedCharacter`, because that is what a
 * client copying a sheet back would send. `experience` is here even though it *is* stored player
 * state: a **fresh** character has none by definition (TICKET-RES-01), so a creation carrying it is
 * asking to start levelled up.
 */
const DERIVED_FIELDS = [
  'statValues',
  'statTotal',
  'level',
  'pointBudget',
  'pointsRemaining',
  'skillLevels',
  'combatBonuses',
  'equipmentBonuses',
  'rollInputs',
  'rollResults',
  'currentResourceValues',
  'experience',
];

/**
 * What a request asked to create, or the reason it cannot be read (v3 Req 40.5)
 *
 * @param body Whatever arrived
 * @returns The Player's choices
 * @throws {AppError} 400 naming the first derived field it carried, or the first field it got wrong
 */
export function creationDataFrom(body: CharacterCreateRequest): CharacterCreationData {
  // Whatever actually arrived, rather than the shape a client *claims* to have sent — the request
  // type describes the contract and this function is what enforces it
  const sent = (body ?? {}) as unknown as Record<string, unknown>;

  const derived = DERIVED_FIELDS.find((field) => sent[field] !== undefined);

  if (derived !== undefined) {
    throw badRequest(
      `A character's ${derived} is worked out from the ruleset, so it cannot be sent. Remove it ` +
        'and send only the choices the Player made.'
    );
  }

  return {
    name: requiredString(sent.name, 'name'),
    raceIds: idList(sent.raceIds, 'raceIds'),
    investedStatPoints: pointMap(sent.investedStatPoints, 'investedStatPoints'),
    archetypeId: optionalString(sent.archetypeId, 'archetypeId'),
    investedSkillPoints: pointMap(sent.investedSkillPoints, 'investedSkillPoints'),
    // Absent stays absent (TICKET-SKL-05): a Snapshot that states neither focus dial asks for no
    // picks, so an empty list and a missing field are one thing here as they are on the document.
    // How many there may be and whether they name real skills is the Kernel's
    // (`focusPickRefusal`, through `characterCreationErrors`); this only says it is a list of ids.
    focusSkillIds: optionalIdList(sent.focusSkillIds, 'focusSkillIds'),
  };
}

/** A field that has to be a non-empty string */
function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`A character needs a ${field}.`);
  }

  return value.trim();
}

/** A field that is a string when it is there at all */
function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest(`${field} has to be an id.`);

  return value;
}

/** A field that has to be a list of ids */
function idList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw badRequest(`${field} has to be a list of ids.`);
  }

  return value as string[];
}

/** {@link idList} for a field that may be absent — a list of ids when it is there at all */
function optionalIdList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;

  return idList(value, field);
}

/**
 * A field that has to be a map of id → whole, non-negative number of points
 *
 * **Finite and integral, checked here rather than by the engine.** `validateStatAllocation` prices
 * what it is given; a `NaN` or an `Infinity` would come back as an unpriceable gain and be reported
 * as though the *ruleset* could not price it, which sends the reader looking in the wrong place.
 *
 * **Non-negative is the half the review found missing**, and it mattered because of *where* it was
 * missing. `characterStore.setInvestedSkillPoints` refuses a negative in the browser, and nothing
 * refused one here — so the server was laxer than the client it is supposed to be authoritative
 * over, which is the exact shape v3 Req 45.3 rules out. `validateStatAllocation` catches a negative
 * *stat* spend as a `negative-points` violation; nothing looked at skills at all.
 */
function pointMap(value: unknown, field: string): Record<string, number> {
  if (value === undefined) return {};

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest(`${field} has to be a map of id to points.`);
  }

  for (const [id, points] of Object.entries(value)) {
    if (typeof points !== 'number' || !Number.isInteger(points)) {
      throw badRequest(`${field} has to be a whole number of points, and ${id} is not.`);
    }

    if (points < 0) throw badRequest(`${id} cannot take fewer than 0 points.`);
  }

  return value as Record<string, number>;
}

/**
 * A row as a client reads it
 *
 * **The document is parsed rather than passed through**, so a client gets an object and not a
 * string — the same boundary `documentOf` applies to a ruleset. A row this server wrote is a row
 * this server can parse, so the type assertion is a statement about our own storage rather than a
 * claim about untrusted input.
 *
 * @param row The stored character
 * @returns What goes on the wire
 */
export function toCharacterDocument(row: CharacterRow): CharacterDocument {
  return {
    id: row.id,
    sessionId: row.sessionId,
    rulesetId: row.rulesetId,
    ownerAccountId: row.ownerAccountId,
    name: row.name,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    character: JSON.parse(row.data) as Character,
  };
}
