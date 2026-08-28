/**
 * What the DM-control routes share (TICKET-DM-01)
 *
 * Deliberately almost nothing, and that is the ticket's argument rather than an accident. A DM
 * adjustment is the same operation a player action is — guard, read the body, run a Kernel rule
 * against the stored state, persist the answer and log what moved — so these routes reuse
 * [`applyPlayerAction`](../play/playPayloads.ts) whole rather than growing a parallel pipeline
 * beside it. The only thing that differs is the guard, and a guard belongs to the route that names
 * it (`routeGuards.test.ts` reads the call site, not an import).
 *
 * What is left over is the one constant below, which exists because the Event payload has a
 * `target` field that only *some* actions fill.
 *
 * **Validates: v3 Req 42.6**
 */

/**
 * What an adjustment to the character as a whole names as its target
 *
 * `PlayerActionEvent.target` says which stat, skill, slot or item moved — and experience and the
 * point grant move none of them, they move the character. Empty rather than `'experience'` or the
 * character's own id: a reader of the log has the `action` already, and a target repeating it would
 * be a second name for the same fact that a later reader could take for an entity id.
 */
export const WHOLE_CHARACTER = '';
