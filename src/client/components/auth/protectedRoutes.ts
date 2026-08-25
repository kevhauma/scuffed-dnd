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
 * invitations (v3 Req 32.6). Today that is `/account` alone, because it is the only surface that
 * asks the server about *this Account*. TICKET-RUL-01 and GAM-01 add theirs as they build them.
 *
 * **Validates: v3 Req 32.6**
 */

/**
 * Every protected route, by path prefix
 *
 * A **prefix** rather than an exact path so that `/sessions/abc/roster` is covered by `/sessions`
 * without every child route being listed — which is the shape that would rot. The boundary is a
 * path segment: `/account` covers `/account/sessions` and does not cover `/accounts-payable`.
 */
export const PROTECTED_ROUTES = ['/account'] as const;

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
