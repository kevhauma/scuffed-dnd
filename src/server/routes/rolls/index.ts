/**
 * The roll routes (TICKET-ROLL-07)
 *
 * Two of them, and they sit on either side of the same Event: `POST /api/characters/:id/roll`
 * resolves one and appends it, `GET /api/sessions/:id/rolls` reads the table's log back. The first
 * is a Player's own act and uses `requireCharacterPlayer`; the second is the table's and uses
 * `requireMember`, because a game is played out loud.
 *
 * **Beside `routes/play/` rather than inside it** — see `rollPayloads.ts` for why a roll is a
 * different kind of act from a write to the sheet.
 */

export * from './listRolls';
export * from './rollDice';
export * from './rollPayloads';
