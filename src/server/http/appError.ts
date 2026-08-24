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
 * **Validates: v3 Req 32.5**
 */

/** The machine-readable half of a refusal — a client switches on this, never on the message */
export const ERROR_CODE = {
  BAD_REQUEST: 'bad_request',
  NOT_FOUND: 'not_found',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  INTERNAL: 'internal',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/**
 * What each code means on the wire
 *
 * Deliberately short: a code with no producer is a code nobody has decided the meaning of yet.
 * AUTH-03 and RUL-02 add theirs — `conflict` for the `revision` guard in particular — when they
 * have something that throws them.
 */
export const STATUS_FOR_CODE: Record<ErrorCode, number> = {
  [ERROR_CODE.BAD_REQUEST]: 400,
  [ERROR_CODE.NOT_FOUND]: 404,
  [ERROR_CODE.METHOD_NOT_ALLOWED]: 405,
  [ERROR_CODE.INTERNAL]: 500,
};

/** The body every refusal has, whichever route produced it */
export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/** A refusal a handler chose to make */
export class AppError extends Error {
  /** The HTTP status this code is sent with */
  readonly status: number;

  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
    this.status = STATUS_FOR_CODE[code];
  }

  /** The wire form — the only shape a client ever parses */
  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** The request body was unreadable or did not say what it must */
export function badRequest(message: string): AppError {
  return new AppError(ERROR_CODE.BAD_REQUEST, message);
}

/** No route answers this method at this path */
export function methodNotAllowed(message: string): AppError {
  return new AppError(ERROR_CODE.METHOD_NOT_ALLOWED, message);
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
