/**
 * The player-action routes (TICKET-PLY-01)
 *
 * Ten writes a Player makes to their own sheet, one module each, all under
 * `POST /api/characters/:id/<action>` where `<action>` is a value of `PLAYER_ACTION`. The path, the
 * Event's `type` and the client's call all spell the intent the same way, which is what lets the log
 * say *what happened* rather than that something did.
 *
 * They live beside `routes/characters/` rather than inside it because the two answer different
 * questions: that folder is *which characters are mine*, this one is *what I am doing at the table*.
 *
 * One module per route, for the reason `routes/rulesets/index.ts` gives — `routeGuards.test.ts`
 * scans a **module** for a guard call, so several handlers in one file would let one
 * `requireCharacterPlayer` stand for all of them.
 */

export * from './adjustResource';
export * from './buildItem';
export * from './dropItem';
export * from './equipItem';
export * from './investSkillPoints';
export * from './investStatPoints';
export * from './playPayloads';
export * from './resetResource';
export * from './setFocusSkills';
export * from './setResource';
export * from './unequipItem';
