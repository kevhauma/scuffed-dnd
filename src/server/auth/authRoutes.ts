/**
 * Everything under `/api/auth/*` (TICKET-AUTH-01)
 *
 * Better Auth's handler is already a function from `Request` to `Response`, which is the same shape
 * SRV-01 gave every other route — so this is a delegation rather than an adaptation layer. What it
 * adds is the one thing the library cannot do for us: the **per-address** sign-in limit v3 Req 30.7
 * asks for (see [`signInRateLimit.ts`](./signInRateLimit.ts) for why the library's own IP-keyed one
 * does not answer it).
 *
 * **It does not go through `defineHandler`, but it keeps that pipeline's two guarantees by hand.**
 * The response *shaper* would only damage a finished `Response` that already carries `Set-Cookie`.
 * The **error boundary** and the `nosniff` header are a different matter: without them this would
 * be the only path through `handleApiRequest` where a thrown error escapes to the framework
 * unlogged, and the only API response a browser is allowed to sniff the content type of.
 *
 * **Validates: v3 Req 30.6, 30.7**
 */

import { serverEnv } from '../env';
import { ERROR_CODE } from '../http/appError';
import { authServer } from './authServer';
import { SIGN_IN_PATH } from './paths';
import { clearSignInFailures, isSignInLimited, recordSignInFailure } from './signInRateLimit';

/** What a refused-for-too-many-attempts answer looks like */
const TOO_MANY_REQUESTS = 429;

/** Anything at or above this is a request that did not work */
const FIRST_ERROR_STATUS = 400;

/** The code a rate-limited caller is given */
const TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS';

/**
 * The headers this module adds to whatever Better Auth produced
 *
 * `nosniff` only: `cache-control: no-store` is already on the session routes by the library's own
 * doing, and the rest of the response — `Set-Cookie` above all — is its business, not ours.
 */
const ADDED_HEADERS = { 'x-content-type-options': 'nosniff' };

/**
 * The address a sign-in request is for, if this is one
 *
 * The body is read from a **clone**, so the request handed to Better Auth still has its stream.
 * A body that is not JSON, or JSON without an email, is not this function's problem — Better Auth
 * refuses it, and refusing it here first would be a second opinion about what a valid request is.
 *
 * @param request The incoming request
 * @returns The email address, or `null` when this is not an email sign-in
 */
async function signInEmail(request: Request): Promise<string | null> {
  const { pathname } = new URL(request.url);
  if (request.method !== 'POST' || pathname !== SIGN_IN_PATH) return null;

  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === 'string' && body.email.trim() !== '' ? body.email : null;
  } catch {
    return null;
  }
}

/** The same response shape Better Auth gives its own refusals, so one client path reads both */
function refusal(status: number, code: string, message: string, headers: HeadersInit = {}) {
  // **Top level, not wrapped in `{ error: … }`.** Better Auth serialises `APIError.body` flat, and
  // the client's fetch layer spreads it into `result.error` — so a nested `error` key would leave
  // `result.error.message` undefined and the form would fall back to "check your details", which
  // is exactly the wrong thing to tell somebody who is locked out for fifteen minutes.
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

/** The same body the pipeline gives a bug: that something broke, and nothing else */
function internalError(): Response {
  return refusal(500, ERROR_CODE.INTERNAL, 'Internal server error');
}

/**
 * What Better Auth says, once the address has been allowed to ask
 *
 * @param request The incoming request
 * @returns The response, including its `Set-Cookie` headers
 */
export async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    return withAddedHeaders(await answer(request));
  } catch (error) {
    // The pipeline's contract, kept by hand: a bug is logged server-side where it is useful, and
    // the client is told only that something broke. `authServer()` reaches the environment, the
    // database and Better Auth's own construction, all lazily — so the first real request is
    // exactly where a misconfiguration surfaces, and it must not surface as a framework error page.
    console.error('[api] unhandled error in the auth subtree', error);
    return internalError();
  }
}

/** The response, with the headers this layer owes it */
function withAddedHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(ADDED_HEADERS)) response.headers.set(name, value);
  return response;
}

/** The delegation itself, with the per-address limit around it */
async function answer(request: Request): Promise<Response> {
  const email = await signInEmail(request);

  if (email !== null) {
    if (isSignInLimited(email)) {
      // Refused **without being tried**: the password is not checked, so this costs an attacker a
      // request and tells them nothing about whether it would have worked. `Retry-After` because a
      // client that is not an attacker deserves to know when to come back.
      return refusal(
        TOO_MANY_REQUESTS,
        TOO_MANY_ATTEMPTS,
        'Too many sign-in attempts for that email address. Try again later.',
        { 'retry-after': String(serverEnv().signInWindowSeconds) }
      );
    }

    // **Counted before the attempt, not after.** Recording on the way out would leave the check and
    // the increment either side of an `await`, so N requests arriving before the first resolves
    // would all read a count of zero and all get a password check — a limit that constrains only a
    // *sequential* attacker, which is not the attacker Req 30.7 names. Counting first means an
    // in-flight attempt is a spent attempt; the cost is that a success has to give one back.
    recordSignInFailure(email);
  }

  const response = await authServer().handler(request);

  // Only a success gives the attempt back. Deliberately keyed on "not an error" rather than on a
  // specific status: every failure path in Better Auth's sign-in throws an `APIError`, and treating
  // an unrecognised failure as a success would be a limit an attacker steers around.
  if (email !== null && response.status < FIRST_ERROR_STATUS) clearSignInFailures(email);

  return response;
}

/** Re-exported so `apiRouter` takes one import for one delegation */
export { AUTH_PREFIX } from './paths';
