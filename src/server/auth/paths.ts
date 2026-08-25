/**
 * Where the auth routes live (TICKET-AUTH-01)
 *
 * A file of its own so that `authServer.ts` (which needs it as `basePath`), `authRoutes.ts` (which
 * matches on it) and `http/apiRouter.ts` (which delegates on it) all read the same constant without
 * importing each other. `authServer` ← `authRoutes` is already a real edge, so declaring it in
 * either of the first two would make the pair circular.
 *
 * **It cannot derive from `API_PREFIX`** — `apiRouter` imports `authRoutes`, so importing back the
 * other way would be a cycle. `apiRouter.test.ts` asserts the two agree instead, which is the same
 * guarantee by a route that does not create one.
 */

/** Everything under here is Better Auth's, and is delegated to it whole */
export const AUTH_PREFIX = '/api/auth';

/** The one path a failed attempt is counted against (v3 Req 30.7) */
export const SIGN_IN_PATH = `${AUTH_PREFIX}/sign-in/email`;

/**
 * The same path as Better Auth itself names it — relative to `basePath`
 *
 * Its rate-limiter matches on the pathname with the base stripped, so this is the spelling its
 * `customRules` key needs. Derived rather than written twice.
 */
export const SIGN_IN_ROUTE = SIGN_IN_PATH.slice(AUTH_PREFIX.length);
