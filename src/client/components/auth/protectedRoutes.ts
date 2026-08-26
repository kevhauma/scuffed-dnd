/**
 * The routes that need an Account, as an explicit list (TICKET-AUTH-03)
 *
 * **The default is open, and that is D6 rather than laziness.** Signed out, the app is the whole
 * v2.0 product: eleven configuration panels, the creation wizard, the character sheet, import and
 * export — all of it against the browser's own LocalStorage, none of it the server's business. A
 * route is protected only by appearing here, so a future route is open unless somebody says
 * otherwise, and `protectedRoutes.test.ts` enumerates the generated route tree to prove that the
 * open set really is everything else (v3 Req 32.6).
 *
 * The inverse — a deny-list, or a guard on the root layout with exceptions — fails the wrong way:
 * the day somebody adds `/config/spells` and forgets to except it, local mode breaks for every
 * signed-out visitor and nothing catches it.
 *
 * **What belongs here is *reaching server-owned data*** — account rulesets, game sessions,
 * invitations (v3 Req 32.6).
 *
 * **`/rulesets` is deliberately absent and always will be**, which is the distinction worth keeping
 * straight: that page is D6's, and signed out it is the browser's own ruleset working completely
 * without an account. A **game session** is other people by definition, so `/sessions` and `/join`
 * are here (TICKET-GAM-02) — and `/join` being protected is what makes AUTH-03's return-to-route
 * behaviour do GAM-02's work: follow a link signed out, sign in, land back on the invitation.
 *
 * **Validates: v3 Req 32.6, 32.7**
 */

/**
 * Every protected route, by path prefix
 *
 * A **prefix** rather than an exact path so that `/sessions/abc/roster` is covered by `/sessions`
 * without every child route being listed — which is the shape that would rot. The boundary is a
 * path segment: `/account` covers `/account/sessions` and does not cover `/accounts-payable`.
 */
export const PROTECTED_ROUTES = ['/account', '/sessions', '/join'] as const;

/**
 * Whether a path needs an Account
 *
 * @param pathname The route being visited
 * @returns True when the visitor must be signed in to see it
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
