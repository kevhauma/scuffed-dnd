/**
 * What the two roots agree an API response looks like (TICKET-RUL-01)
 *
 * **A contract both sides need, so it lives in the Kernel** — the rule
 * [CLAUDE.md](../../../CLAUDE.md) states as *"a rule both sides need lives in `shared/`"*, and
 * `#shared/types/socialProvider` is the precedent: the server produces these shapes, the client
 * branches on them, and a copy on either side is a copy that can drift silently. Nothing here is
 * behaviour — `AppError`, the status map and the factory functions stay in `server/http/appError.ts`
 * where they belong, and `client/services/api.ts` never learns how a refusal is *made*.
 *
 * The RUL-01 review found four duplicated declarations that this module replaces, one of them a
 * bare `'conflict'` literal in the client. A renamed code would have quietly stopped matching, and
 * grepping a bare literal finds coincidences rather than the contract.
 *
 * **Validates: v3 Req 32.5, 33.1, 33.8**
 */

/**
 * The machine-readable half of a refusal — a client switches on this, never on the message
 *
 * Deliberately short: a code with no producer is a code nobody has decided the meaning of yet.
 */
export const ERROR_CODE = {
  BAD_REQUEST: 'bad_request',
  /** Nobody is signed in, on a route that needs somebody to be (TICKET-AUTH-03) */
  UNAUTHENTICATED: 'unauthenticated',
  NOT_FOUND: 'not_found',
  METHOD_NOT_ALLOWED: 'method_not_allowed',
  /** The request was understood and refused by the *state* of the resource (TICKET-RUL-01) */
  CONFLICT: 'conflict',
  INTERNAL: 'internal',
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** The body every refusal has, whichever route produced it */
export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

/**
 * A Ruleset as a client sees it in a listing (v3 Req 33.8)
 *
 * Names and last-modified times, which is what the requirement asks for, plus the two the client
 * needs in order to act: `id` to open one and `revision` to write one back.
 *
 * **There is no `data` here, and that is a rule rather than an economy.** A list endpoint that
 * hands back whole documents invites a client that renders from the list and then edits the copy it
 * happens to hold, which is how RUL-02's revision guard gets bypassed by accident. The repository
 * refuses to *select* the column and this refuses to *name* it.
 */
export interface RulesetSummary {
  id: string;
  name: string;
  schemaVersion: number;
  revision: number;
  /** Epoch milliseconds, as the column holds it — formatting is the browser's locale, not ours */
  createdAt: number;
  updatedAt: number;
}

/** What `GET /api/rulesets` answers — most recently updated first, empty for a new Account */
export interface RulesetListing {
  rulesets: RulesetSummary[];
}
