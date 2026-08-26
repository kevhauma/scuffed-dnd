/**
 * The `/api/characters` routes (TICKET-CHAR-04)
 *
 * **The Account-scoped half of a character.** A character *at a table* is reached through that
 * table — `routes/sessions/createCharacter.ts` and `listCharacters.ts` — because who may see it is
 * a fact about the session. What is here is the other state a character can be in: uploaded from a
 * browser, owned by an Account, at no table (v3 Req 36.5), which until this ticket had no surface
 * at all.
 *
 * One module per route, for the reason `routes/rulesets/index.ts` gives.
 */

export * from './characterPayloads';
export * from './deleteCharacter';
export * from './listMyCharacters';
