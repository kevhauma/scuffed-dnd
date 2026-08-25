/**
 * Calling a route the way the server does (TICKET-DX-06)
 *
 * **It calls the real thing.** A route is already a function from `Request` to `Response` — SRV-01
 * shaped it that way on purpose — so there is no test double here and no second pipeline. The
 * status a refusal produces in a test is the status it produces in production because it is the
 * same `defineHandler` catch mapping an `AppError` to `error.status`, not a copy of that rule.
 *
 * The milestone's Definition of Done asks every route to prove it refuses an anonymous caller, a
 * non-owner and a non-member. This exists so that is three lines:
 *
 * ```ts
 * expect((await callRoute(route, { as: null })).status).toBe(404);
 * expect((await callRoute(route, { as: stranger })).status).toBe(404);
 * expect((await callRoute(route, { as: owner })).status).toBe(200);
 * ```
 *
 * **404 rather than 401 for the anonymous caller**, on a route naming an owned resource: v3 Req
 * 32.5 asks an unauthorized read and a missing record to be indistinguishable, and the cheapest way
 * to keep that true is for every refusal on such a route to be the same refusal. A route whose
 * existence is not itself a secret may answer 401; a route that would confirm somebody else's
 * ruleset exists may not.
 *
 * **Validates: v3 Req 45.3**
 */

import type { RequestAccount, RequestScope, Route } from '../http/pipeline';

/** What a call is told about itself */
export interface CallOptions {
  /**
   * Who is asking. `null` or absent is the anonymous caller
   *
   * Accepts an account or a bare id, because a seeded row and the string a test just made up are
   * both reasonable things to have in hand at the call site.
   */
  as?: RequestAccount | string | null;
  /** Defaults to `GET`, or to `POST` when a body is given */
  method?: string;
  /** The path, with or without a query string. Defaults to `/api/test` */
  path?: string;
  /** Sent as JSON. Pass a string to send a body that is deliberately *not* JSON */
  body?: unknown;
  /** Appended to the path as a query string */
  params?: Record<string, string>;
}

/** What a call comes back as */
export interface CallResult<T = unknown> {
  status: number;
  /** The parsed JSON body, or `null` for a 204 and for any response without one */
  body: T;
  headers: Headers;
}

/**
 * The origin every test request is made against
 *
 * Same-origin is the only shape this app has (D1): the API is a relative path and no variable
 * names a backend. The host here is therefore arbitrary and never read — `new URL` simply needs
 * one to parse against.
 */
const TEST_ORIGIN = 'http://localhost';

/** An account or a bare id, as one account */
function accountFrom(as: CallOptions['as']): RequestAccount | null {
  if (as === null || as === undefined) return null;
  return typeof as === 'string' ? { id: as } : as;
}

/** The method a call meant, given what it did and did not say */
function methodFrom(options: CallOptions): string {
  if (options.method) return options.method;
  return options.body === undefined ? 'GET' : 'POST';
}

/** The URL a call meant */
function urlFrom(options: CallOptions): string {
  const url = new URL(options.path ?? '/api/test', TEST_ORIGIN);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * The body as bytes, and the content type that goes with it
 *
 * A `string` body is passed through untouched so a test can send something that is *not* JSON and
 * watch the pipeline refuse it — which is the one case `JSON.stringify` would quietly make valid.
 */
function bodyFrom(body: unknown): { body: string; headers: Record<string, string> } | null {
  if (body === undefined) return null;
  if (typeof body === 'string') return { body, headers: {} };
  return { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } };
}

/**
 * Call a route and read what came back
 *
 * @param route The route, as `defineHandler` returned it
 * @param options Who is asking and what they sent
 * @returns The status, the parsed body and the response headers
 */
export async function callRoute<T = unknown>(
  route: Route,
  options: CallOptions = {}
): Promise<CallResult<T>> {
  const payload = bodyFrom(options.body);

  const request = new Request(urlFrom(options), {
    method: methodFrom(options),
    headers: payload?.headers,
    body: payload?.body,
  });

  // Named rather than passed inline: `pipeline.test.ts` asserts that exactly two modules under
  // src/server mention `RequestScope`, which is the guard on how many things can say who is asking
  const scope: RequestScope = { account: accountFrom(options.as) };

  const response = await route(request, scope);

  // A 204 has no body and a `.json()` on it throws; so does a 500 whose body the pipeline built
  // from something unserialisable. Neither is what the test asked about, so both come back `null`
  // and the status carries the meaning.
  const body = await response
    .clone()
    .json()
    .catch(() => null);

  return { status: response.status, body: body as T, headers: response.headers };
}
