/**
 * What a legal crossing points at (TICKET-DX-07)
 *
 * `client/` and `server/` may both import this. It exists so `architecture/boundaries.test.ts` can
 * assert the *allowed* direction is allowed, not only that the forbidden ones are refused — a
 * boundary check that refuses everything passes every violation test and is still worthless.
 */

export const SHARED_VALUE = 'a rule both sides call the one copy of';
