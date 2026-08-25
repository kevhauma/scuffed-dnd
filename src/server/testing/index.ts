/**
 * The server test harness (TICKET-DX-06)
 *
 * One way to spin up a server test with a real database and a signed-in account, so that *does
 * this route refuse a non-member?* is three lines rather than thirty. That matters more than
 * convenience: the milestone's Definition of Done requires **every** server route to prove it
 * refuses an anonymous caller, a non-owner and a non-member, and a proof that is expensive is a
 * proof that gets skipped — at which point "authorization is real" stops being falsifiable.
 *
 * ```ts
 * it('should refuse a stranger', () =>
 *   withTestDatabase(async (database) => {
 *     const owner = seedAccount();
 *     const row = seedRuleset(database, { owner });
 *
 *     expect((await callRoute(route, { as: null, params: { id: row.id } })).status).toBe(401);
 *     expect((await callRoute(route, { as: seedAccount(), params: { id: row.id } })).status).toBe(404);
 *     expect((await callRoute(route, { as: owner, params: { id: row.id } })).status).toBe(200);
 *   }));
 * ```
 *
 * The stranger's 404 is deliberate rather than lazy — see `callRoute.ts` for why an owned resource
 * answers a stranger and a missing row identically, and why the anonymous caller's 401 does not
 * undo that (v3 Req 32.5).
 *
 * **Nothing here may be imported by production code** — `test-harness-stays-in-tests` in
 * `.dependency-cruiser.mjs` refuses it, which is what pays for `testing/` being allowed to reach
 * the connection at all.
 *
 * **There is no shared test server, deliberately.** A listening process reintroduces test-order
 * coupling, which is the one thing this harness exists to prevent — and SRV-01 shaped a route as a
 * function from `Request` to `Response` precisely so none is needed.
 */

export * from './callRoute';
export * from './database';
export * from './oauthProvider';
export * from './seeds';
