/**
 * Talking to this app's own API (TICKET-RUL-01)
 *
 * **A relative path, always.** There is no base URL, no `VITE_API_URL` and no way to point this at
 * another host, because the backend is *this* server — one process serving the client bundle, the
 * API and the socket
 * ([D1](../../../docs/v3.0_backend/overview.md#d1--the-backend-lives-in-this-repo-on-tanstack-start)).
 * Every request is therefore same-origin, which is also why no CORS layer exists anywhere in this
 * milestone. A configurable base would be a variable somebody eventually points elsewhere.
 *
 * **Better Auth keeps its own client** (`components/auth/authClient.ts`) and is not routed through
 * here: `/api/auth/*` is a subtree the library owns end to end, cookies and all.
 *
 * **Local mode never calls this.** Signed out, the app is the whole v2.0 product against
 * LocalStorage (D6) — a hook that reaches the network does so only after `useAuth` says there is an
 * Account, and RUL-02 asserts that with the network stubbed to throw.
 *
 * **Validates: v3 Req 47.6**
 */

import type { ErrorBody, ErrorCode } from '#shared/types/api';

/**
 * The two codes that describe the *transport* rather than a decision the server made
 *
 * Beside {@link ERROR_CODE} rather than in it: a server never sends either of these, and putting
 * them in the shared contract would claim it might. They are here because {@link ApiError} needs a
 * code in cases where there is no response to read one from, and because this module must not
 * compare against a bare literal to produce them.
 *
 * **Not exported**, because nothing outside this file branches on either yet — a caller that
 * decided to (an offline banner, say) exports it in the same change, which is one line. An exported
 * constant with no consumer is a claim that something uses it.
 */
const TRANSPORT_CODE = {
  /** The request never arrived — nothing was decided, so there is nothing for the User to fix */
  OFFLINE: 'offline',
  /** A refusal arrived without a body this build can read */
  UNKNOWN: 'unknown',
} as const;

/** Anything `ApiError.code` can be: what the server decided, or what the transport did */
export type ApiErrorCode = ErrorCode | (typeof TRANSPORT_CODE)[keyof typeof TRANSPORT_CODE];

/**
 * A request the server refused, or one that never arrived
 *
 * Carries the server's own `code` so a caller can branch on *why* — a 409 conflict wants a
 * different surface from a 404 — and its `message`, which every refusal writes as a sentence a
 * User can act on rather than as a stack trace. The code is typed against the **shared** contract
 * (`#shared/types/api`), so a caller comparing it writes `ERROR_CODE.CONFLICT` and a renamed code
 * is a compile error on both sides at once.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    /** The HTTP status, or 0 when the request never reached the server */
    public readonly status: number,
    public readonly code: ApiErrorCode,
    /**
     * The whole refusal body, for the details a route attached beside `error` (TICKET-RUL-02)
     *
     * A conflict carries the revision it is behind and a shape refusal carries the failing fields
     * — both things the caller has to act on and cannot work out. `null` when there was no readable
     * body at all. Typed loosely on purpose: the caller knows which route it called and casts to
     * that route's refusal shape, rather than this module knowing every one of them.
     */
    public readonly body: unknown = null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** What a caller who could not reach the server at all is told */
const OFFLINE = new ApiError(
  'Could not reach the server. Check your connection and try again.',
  0,
  TRANSPORT_CODE.OFFLINE
);

/** A response with nothing in it — a delete has no body to give back */
const NO_CONTENT = 204;

/** What to say when a refusal arrives without a readable body */
function messageFrom(body: ErrorBody | null, status: number): string {
  return body?.error?.message ?? `The server refused that request (${status}).`;
}

/**
 * Call the API and read what came back
 *
 * **A route with nothing to say answers 204**, and this returns `undefined` for it — so a caller of
 * such a route asks for `apiRequest<void>` and the type stays honest. Asking for a body from a route
 * that sends none is the caller's mistake, and spelling the `void` at the call site is what makes it
 * one somebody can see.
 *
 * @param path A path under `/api`, with any query string already on it
 * @param init Method and body, as `fetch` takes them
 * @returns The parsed JSON body, or `undefined` for a 204
 * @throws {ApiError} For any non-2xx response, and when the request never arrived
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch {
    // A network failure is not a refusal and must not be reported as one: nothing was decided, so
    // there is nothing for the User to fix except their connection
    throw OFFLINE;
  }

  if (response.status === NO_CONTENT) return undefined as T;

  const body = (await response.json().catch(() => null)) as (ErrorBody & T) | null;

  if (!response.ok) {
    throw new ApiError(
      messageFrom(body, response.status),
      response.status,
      body?.error?.code ?? TRANSPORT_CODE.UNKNOWN,
      body
    );
  }

  return body as T;
}

/**
 * Send a JSON body
 *
 * `method` is a plain string rather than a const object of verbs: it goes straight into
 * `RequestInit`, which types it that way, and a two-member enum named after this ticket's two
 * callers is the abstraction-before-its-third-caller the conventions warn about.
 */
export function apiSend<T>(path: string, method: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method, body: JSON.stringify(body) });
}
