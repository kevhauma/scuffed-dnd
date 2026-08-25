/**
 * The one error a handler throws on purpose (TICKET-SRV-01)
 *
 * Everything a route refuses is an `AppError`: a machine-readable code and a sentence a User could
 * act on. Everything else that escapes a handler is a bug, and the pipeline turns it into a bare
 * 500 — the split matters because it decides what reaches the client. A deliberate refusal explains
 * itself; a bug says nothing, because what it would say is a stack trace.
 *
 * **The status comes from the code, not from the caller.** They are two spellings of the same
 * decision, and letting a call site pick both is letting them disagree — a 200 carrying
 * `not_found`, or a status outside 200–599, which would throw inside the pipeline's own catch and
 * escape the one thing it promises never happens.
 *
 * **The codes and the body shape moved to the Kernel in TICKET-RUL-01**, and only they did. A
 * refusal is a *contract* — the client branches on `code` and renders `message` — so it belongs
 * where both roots can name it (`#shared/types/api`), and the client's copy of the enum went with
 * it. What stays here is the behaviour: which status a code is sent with, the error class, and the
 * factories. Nothing in `client/` learns how a refusal is made.
 *
 * **Validates: v3 Req 32.5**
 */

import { ERROR_CODE, type ErrorBody, type ErrorCode, type ErrorDetails } from '#shared/types/api';

export { ERROR_CODE };
export type { ErrorBody, ErrorCode, ErrorDetails };

/**
 * What each code means on the wire
 *
 * Deliberately short: a code with no producer is a code nobody has decided the meaning of yet.
 * `conflict` arrived with TICKET-RUL-01, which has two producers for it — a delete a Game_Session
 * stands in the way of, and a write whose base `revision` is behind. RUL-02 reuses the second.
 *
 * **This half is deliberately server-only.** A status is what *this* server chooses to send; the
 * client already has the status on the response and has no use for the map.
 */
export const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  [ERROR_CODE.BAD_REQUEST]: 400,
  [ERROR_CODE.UNAUTHENTICATED]: 401,
  [ERROR_CODE.NOT_FOUND]: 404,
  [ERROR_CODE.METHOD_NOT_ALLOWED]: 405,
  [ERROR_CODE.CONFLICT]: 409,
  [ERROR_CODE.INTERNAL]: 500,
};

/** A refusal a handler chose to make */
export class AppError extends Error {
  /** The HTTP status this code is sent with */
  readonly status: number;

  constructor(
    public readonly code: ErrorCode,
    message: string,
    /**
     * Extra the client needs in order to act; merged into the wire body beside `error`
     *
     * Typed against the **shared** `ErrorDetails` rather than an open record, so a misspelled key
     * is a compile error on this side instead of an `undefined` on the other.
     */
    public readonly details: ErrorDetails = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_FOR_CODE[code];
  }

  /** The wire form — the only shape a client ever parses */
  toBody(): ErrorBody & ErrorDetails {
    return { ...this.details, error: { code: this.code, message: this.message } };
  }
}

/** The request body was unreadable or did not say what it must */
export function badRequest(message: string, details?: ErrorDetails): AppError {
  return new AppError(ERROR_CODE.BAD_REQUEST, message, details);
}

/** No route answers this method at this path */
export function methodNotAllowed(message: string): AppError {
  return new AppError(ERROR_CODE.METHOD_NOT_ALLOWED, message);
}

/**
 * The caller may do this, and right now the resource will not let them (TICKET-RUL-01)
 *
 * **Distinct from {@link notFound} without weakening it.** Every conflict is thrown *after* a
 * successful ownership check, so the caller already knows the resource exists — telling them *why*
 * their write did not land leaks nothing they had not earned, and withholding it would leave them
 * with a refusal they cannot act on. v3 Req 33.8 is explicit that a refused write is a conflict the
 * User can resolve, never a silent loss.
 *
 * The message is where the resolution goes: what is in the way, and what confirming would do.
 */
export function conflict(message: string, details?: ErrorDetails): AppError {
  return new AppError(ERROR_CODE.CONFLICT, message, details);
}

/**
 * Nobody is signed in (TICKET-AUTH-03, v3 Req 32.1)
 *
 * **A 401 here does not undo {@link notFound}'s blurring**, which is the question to ask of it. It
 * is thrown *before any lookup*, so it says something about the caller and nothing about whether a
 * resource exists — an anonymous caller gets the identical answer for a ruleset that is there, one
 * that is not, and one belonging to somebody else. What v3 Req 32.5 forbids is telling apart *those
 * three*, and this cannot: only a signed-in caller ever reaches a lookup, and for them every
 * refusal is a 404.
 *
 * The client half of this is the redirect to sign-in, which needs to know the difference between
 * "sign in and try again" and "there is nothing here" to be able to return you afterwards.
 */
export function unauthenticated(message = 'Sign in to do that.'): AppError {
  return new AppError(ERROR_CODE.UNAUTHENTICATED, message);
}

/**
 * There is nothing here — **or you may not see it** (v3 Req 32.5)
 *
 * The blurring is deliberate and is why this exists as one function rather than as a `notFound`
 * beside a `forbidden`: a 403 on a resource you do not own confirms it exists, which is an answer
 * an unauthorized caller has not earned. AUTH-03 routes both cases through here.
 */
export function notFound(message = 'Not found'): AppError {
  return new AppError(ERROR_CODE.NOT_FOUND, message);
}
