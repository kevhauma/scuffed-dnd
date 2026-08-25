/**
 * Which handler answers a request, and whether one should at all (TICKET-SRV-01)
 *
 * The server entry hands every request here first. Anything outside {@link API_PREFIX} comes back
 * as `null` and falls through to TanStack Start's SSR handler — one process serving the client
 * bundle, the API and (from LIVE-01) the socket, which is D1's whole point.
 *
 * **Matching is exact, deliberately.** There are no path parameters because no route needs one
 * yet; TICKET-RUL-01 brings `/api/rulesets/:id` and extends this then. A pattern matcher written
 * now would be written against imagined routes.
 *
 * **Validates: v3 Req 47.6**
 */

import { AUTH_PREFIX, handleAuthRequest } from '../auth/authRoutes';
import { authProviders } from '../routes/authProviders';
import { health } from '../routes/health';
import { methodNotAllowed, notFound } from './appError';
import { defineHandler } from './pipeline';

/** Everything under here is the API; everything else is the app */
export const API_PREFIX = '/api/';

/**
 * The route table, keyed `METHOD /path`
 *
 * A plain object rather than a registration call: the whole API is readable in one place, and a
 * route that exists is a line here rather than a side effect of importing a file.
 *
 * Typed as *request in, response out* rather than as {@link Route}, and deliberately so: a
 * `Route`'s second parameter is a test seam (TICKET-DX-06), and narrowing the table's type is what
 * makes it a compile error for anything here to reach for it.
 */
export const ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  'GET /api/health': health,
  // Not `/api/auth/providers`: the whole `/api/auth` subtree is handed to Better Auth above,
  // before this table is consulted, so a path under it would never be reached (TICKET-AUTH-02)
  'GET /api/auth-providers': authProviders,
};

/** The paths the table answers, whatever the method */
const KNOWN_PATHS = new Set(Object.keys(ROUTES).map((key) => key.split(' ')[1]));

/**
 * What a request is looked up as
 *
 * `HEAD` is answered by the `GET` route — that is what HEAD *is*, and uptime probes and load
 * balancers use it. The body is dropped below rather than by the handler, so no route has to know.
 */
function lookupMethod(method: string): string {
  return method === 'HEAD' ? 'GET' : method;
}

/**
 * Answer an API request, or decline to
 *
 * @param request The incoming request
 * @returns A response, or `null` when this is not an API request at all
 */
export async function handleApiRequest(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(API_PREFIX)) return null;

  // Better Auth owns a whole subtree rather than a list of paths, and its handler already produces
  // a finished `Response` with `Set-Cookie` on it (TICKET-AUTH-01). It is matched before the table
  // for that reason: there is nothing here to route, only a prefix to hand over.
  if (pathname === AUTH_PREFIX || pathname.startsWith(`${AUTH_PREFIX}/`)) {
    return handleAuthRequest(request);
  }

  const route = ROUTES[`${lookupMethod(request.method)} ${pathname}`];

  if (route) {
    const response = await route(request);
    // A HEAD response carries the headers and none of the body
    return request.method === 'HEAD'
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }

  // A known path with the wrong verb is a different mistake from a path that does not exist, and
  // saying so costs nothing here — no authorization has run yet, so neither answer leaks anything.
  // Neither message repeats the path or the method back: the status carries the meaning, and an
  // unbounded echo of attacker-controlled text into a response body earns nothing.
  return defineHandler(() => {
    throw KNOWN_PATHS.has(pathname)
      ? methodNotAllowed('That method is not allowed on this path.')
      : notFound('No API route matches that path.');
  })(request);
}
