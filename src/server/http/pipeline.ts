/**
 * The request pipeline every API route plugs into (TICKET-SRV-01)
 *
 * parse → authenticate → authorize → act → respond, in one place, so that DB-01 through POL-03
 * inherit the shape rather than each inventing one. Today it does the first and the last of those;
 * TICKET-AUTH-03 fills in the middle by resolving {@link RequestContext.account} and adding the
 * ownership guards, and no route file changes when it does.
 *
 * **A handler returns data and throws refusals.** It never builds a `Response`, never picks a
 * status for the happy path, and never catches its own errors to shape them — that is what makes
 * every route's failure look the same to a client and what stops a stack trace reaching a browser.
 *
 * **Validates: v3 Req 32.1**
 */

import { AppError, badRequest, ERROR_CODE, type ErrorBody } from './appError';

/** What a handler is given */
export interface RequestContext {
  request: Request;
  url: URL;
  /**
   * Who is asking, or nobody (v3 Req 32.1)
   *
   * `null` until TICKET-AUTH-03 resolves the Auth_Session cookie. It is here now, typed, so that
   * every handler written before then is already shaped for the answer.
   */
  account: null;
  /**
   * The request body as JSON
   *
   * @throws {AppError} 400 when the body is absent or not JSON — a handler never has to check
   */
  json: <T>() => Promise<T>;
}

/** What a handler is: data in, data out, refusals thrown. `undefined` means "nothing to say". */
export type Handler = (context: RequestContext) => Promise<unknown> | unknown;

/** The status a successful handler's data is sent with */
const OK = 200;

/** What a handler that returned nothing is sent with — a delete has no body to give back */
const NO_CONTENT = 204;

/** What a bug is allowed to tell a client: that something broke, and nothing else */
const INTERNAL_ERROR_BODY: ErrorBody = {
  error: { code: ERROR_CODE.INTERNAL, message: 'Internal server error' },
};

/**
 * Headers every API response carries
 *
 * `nosniff` because a JSON body should never be interpreted as anything else, and `no-store`
 * because from TICKET-AUTH-03 on every one of these is account-specific — a cached one is the
 * previous account's data handed to the next.
 */
const RESPONSE_HEADERS = {
  'content-type': 'application/json',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

/** A JSON response with the given status */
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: RESPONSE_HEADERS });
}

/**
 * Read the request body as JSON, or refuse
 *
 * @param request The incoming request
 * @returns The parsed body
 * @throws {AppError} 400 if the body is missing or malformed
 */
async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    // The parse error itself is not repeated back: it describes this server's parser, not the
    // caller's mistake, and "the body must be JSON" is the whole of what they can act on
    throw badRequest('The request body must be JSON.');
  }
}

/**
 * Wrap a handler into something that answers a `Request`
 *
 * @param handler What the route does
 * @returns A function from request to response that cannot throw
 */
export function defineHandler(handler: Handler): (request: Request) => Promise<Response> {
  return async (request) => {
    const context: RequestContext = {
      request,
      url: new URL(request.url),
      account: null,
      json: <T>() => readJson<T>(request),
    };

    try {
      const data = await handler(context);

      // A handler with nothing to return gets a 204 rather than a 200 whose body is the four
      // characters `undefined` — which is what `JSON.stringify` produces and what a client's
      // `.json()` then throws on. RUL-01's delete is the first route this catches.
      return data === undefined ? new Response(null, { status: NO_CONTENT }) : json(data, OK);
    } catch (error) {
      if (error instanceof AppError) return json(error.toBody(), error.status);

      // Anything else is a bug, not a refusal. It is logged here — server-side, where it is
      // useful — and the client is told only that something broke, because what a stack trace
      // would tell them is how this server is built.
      console.error('[api] unhandled error', error);

      return json(INTERNAL_ERROR_BODY, 500);
    }
  };
}
