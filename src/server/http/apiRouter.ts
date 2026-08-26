/**
 * Which handler answers a request, and whether one should at all (TICKET-SRV-01)
 *
 * The server entry hands every request here first. Anything outside {@link API_PREFIX} comes back
 * as `null` and falls through to TanStack Start's SSR handler — one process serving the client
 * bundle, the API and (from LIVE-01) the socket, which is D1's whole point.
 *
 * **Two tables, because there are two kinds of path** (TICKET-RUL-01). Most routes are a literal
 * string and are looked up in a map. `/api/rulesets/:id` is not, so {@link PATTERN_ROUTES} matches
 * by segment shape — checked only when the exact table misses, so the common path stays a map
 * lookup. The matcher is deliberately the smallest thing that works: one parameter per segment,
 * no optional segments, no regular expressions, no wildcards. A router with features no route uses
 * is a router nobody can predict.
 *
 * **A matched parameter is not handed to the handler**, which reads it back off `context.url`. The
 * alternative was a `params` channel through `RequestScope`, and `pipeline.test.ts` asserts that
 * exactly two modules name that type — it is the seam that lets a caller say *who is asking*, and
 * widening it to carry path segments would trade a real security guard for a convenience.
 *
 * **Validates: v3 Req 47.6**
 */

import { AUTH_PREFIX, handleAuthRequest } from '../auth/authRoutes';
import { authProviders } from '../routes/authProviders';
import { health } from '../routes/health';
import {
  copyRuleset,
  createRuleset,
  deleteRuleset,
  getRuleset,
  importRuleset,
  listRulesets,
  renameRuleset,
  saveRuleset,
} from '../routes/rulesets';
import {
  archiveSession,
  createSession,
  listSessions,
  readSession,
  refreshSnapshot,
} from '../routes/sessions';
import { uploadPrompt } from '../routes/uploadPrompt';
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
  'GET /api/rulesets': listRulesets,
  'POST /api/rulesets': createRuleset,
  // A literal path in the **exact** table, and it has to be: `POST /api/rulesets/:id` is not a route,
  // so a pattern-only lookup would answer this 405. Exact matches are tried first, which also means
  // this cannot be shadowed by a ruleset that happens to be called `import` (TICKET-IO-04)
  'POST /api/rulesets/import': importRuleset,
  'POST /api/account/upload-prompt': uploadPrompt,
  'GET /api/sessions': listSessions,
  'POST /api/sessions': createSession,
};

/**
 * The routes whose path names a resource, keyed `METHOD /path/with/:parameter`
 *
 * Separate from {@link ROUTES} rather than mixed into it, so the cost of pattern matching is paid
 * only by the requests that need it and so the exact table stays a map lookup that cannot surprise
 * anyone.
 */
export const PATTERN_ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  'GET /api/rulesets/:id': getRuleset,
  'PUT /api/rulesets/:id': saveRuleset,
  'PATCH /api/rulesets/:id': renameRuleset,
  'DELETE /api/rulesets/:id': deleteRuleset,
  'POST /api/rulesets/:id/copy': copyRuleset,
  'GET /api/sessions/:id': readSession,
  'POST /api/sessions/:id/archive': archiveSession,
  'POST /api/sessions/:id/snapshot': refreshSnapshot,
};

/** The path half of a `METHOD /path` key */
function patternOf(key: string): string {
  return key.split(' ')[1] ?? '';
}

/** A path split into its segments, with the leading empty one dropped */
function segments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * Whether a concrete path is what a pattern describes
 *
 * A `:name` segment matches exactly one non-empty segment. Everything else is compared literally.
 *
 * @param pattern The pattern half of a {@link PATTERN_ROUTES} key
 * @param pathname The path that arrived
 * @returns True when the two have the same shape
 */
function matchesPattern(pattern: string, pathname: string): boolean {
  const expected = segments(pattern);
  const actual = segments(pathname);

  if (expected.length !== actual.length) return false;

  return expected.every((segment, index) => segment.startsWith(':') || segment === actual[index]);
}

/** The literal paths the exact table answers, whatever the method — built once, not per request */
const KNOWN_PATHS = new Set(Object.keys(ROUTES).map(patternOf));

/** The patterns the other table answers, likewise */
const KNOWN_PATTERNS = [...new Set(Object.keys(PATTERN_ROUTES).map(patternOf))];

/** The paths either table answers, whatever the method — patterns matched by shape */
function pathIsKnown(pathname: string): boolean {
  return (
    KNOWN_PATHS.has(pathname) || KNOWN_PATTERNS.some((pattern) => matchesPattern(pattern, pathname))
  );
}

/**
 * The handler for a request, if there is one
 *
 * @param method The method to look up as — `HEAD` has already become `GET`
 * @param pathname The path that arrived
 * @returns The route, or `undefined` when nothing answers this method at this path
 */
function findRoute(
  method: string,
  pathname: string
): ((request: Request) => Promise<Response>) | undefined {
  const exact = ROUTES[`${method} ${pathname}`];
  if (exact) return exact;

  const key = Object.keys(PATTERN_ROUTES).find(
    (candidate) =>
      candidate.startsWith(`${method} `) && matchesPattern(patternOf(candidate), pathname)
  );

  return key ? PATTERN_ROUTES[key] : undefined;
}

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

  const route = findRoute(lookupMethod(request.method), pathname);

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
    throw pathIsKnown(pathname)
      ? methodNotAllowed('That method is not allowed on this path.')
      : notFound('No API route matches that path.');
  })(request);
}
