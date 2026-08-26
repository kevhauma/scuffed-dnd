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

import type { Configuration } from './config';
import type { ValidationReport } from './validation';

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
 * What a refusal may carry beside its sentence (TICKET-RUL-02)
 *
 * **Declared here rather than as `Record<string, unknown>` on the server**, which is what it was
 * until the RUL-02 review pointed out the hole: an open record accepts `currentRev` as happily as
 * `currentRevision`, so a typo would compile on the server and read as `undefined` on the client.
 * The whole reason this module exists is that a shape both roots use is checked once.
 *
 * Only what a caller has to **act** on belongs here. What a stack trace would say is how this
 * server is built, and that still never leaves it.
 */
export interface ErrorDetails {
  /** On a `conflict` from a write: what the resource's revision actually is now */
  currentRevision?: number;
  /** On a `bad_request` from shape validation: what failed, in the validator's own words */
  fields?: string[];
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

/**
 * One ruleset **with** its document (TICKET-RUL-02)
 *
 * What `GET /api/rulesets/:id` answers and what `PUT` gives back. Deliberately a different type
 * from {@link RulesetSummary} rather than a summary with an optional field: a listing that could
 * carry a document is a listing somebody will eventually render from and then edit, and the whole
 * point of the split is that they cannot.
 *
 * `configuration` is in **display** form — every formula spelled with the entity's current name,
 * exactly as `importConfiguration` hands one back. The server stores the id-resolved form
 * (TICKET-REF-01) and translates at this boundary, which is the same thing `storage.ts` and the
 * export path do.
 */
export interface RulesetDocument extends RulesetSummary {
  /**
   * The ruleset itself, typed
   *
   * Unlike {@link RulesetSaveRequest.configuration}, which is whatever a client sent and is
   * `unknown` until it has been validated. This one the **server** just produced from a document it
   * had already gated, so typing it is not a claim about untrusted input — and leaving it `unknown`
   * only moved an unchecked `as Configuration` into the config store, where a wrong response would
   * land in every panel.
   */
  configuration: Configuration;
}

/**
 * What a client sends to save a ruleset (v3 Req 33.6)
 *
 * **`revision` is what the caller believed it was**, not what they want it to become — the server
 * increments. A write whose base revision is behind is refused with a `conflict` rather than
 * merged, and the User meets a question rather than a disappearance (v3 Req 33.8).
 *
 * Nothing derived crosses the wire: a `Configuration` is entirely authored data. Stat values,
 * levels, point budgets and roll results are re-derived server-side from it and are refused as
 * input everywhere they appear (the milestone's third Definition-of-Done rule).
 */
export interface RulesetSaveRequest {
  revision: number;
  configuration: unknown;
}

/**
 * What a client sends to create a ruleset from a document it already has (v3 Req 35.1, 36.5)
 *
 * **One request shape for both of IO-04's paths**, because server-side they are one operation.
 * *Import this file* and *upload this browser's ruleset* differ in where the client got the bytes,
 * which is a fact about the client; what the server does with them — gate, shape-check, create,
 * never overwrite — is identical, and two routes would be two places for that chain to drift.
 *
 * `configuration` is `unknown` for {@link RulesetSaveRequest}'s reason: it is whatever a client
 * sent, and it is untrusted until the Kernel's own import gates have run on it.
 */
export interface RulesetImportRequest {
  configuration: unknown;
  /**
   * The Characters to bring along, or nothing
   *
   * Absent on the file-import path — a `Configuration` file has never carried characters — and the
   * browser's stored roster on the upload path. Each becomes a Character owned by the Account and
   * belonging to **no Game_Session**: they were built against a local ruleset rather than against a
   * Snapshot, and inventing a session to hold them would put people at a table nobody started.
   */
  characters?: unknown[];
}

/**
 * What an accepted import answers with (v3 Req 35.3, 35.5)
 *
 * The created ruleset — so the client can name it, rather than saying "imported" and leaving the
 * User to find it — and the engine's **referential** report, which is reported and not fatal. That
 * is the v1.0 rule carried onto the server path unchanged: a ruleset that parses but does not hang
 * together still reaches the User, because refusing it would leave them unable to repair it in the
 * app.
 */
export interface RulesetImportResult extends RulesetSummary {
  report: ValidationReport;
  /** How many Characters were created alongside it — zero on the file-import path */
  charactersCreated: number;
}

/**
 * Whether this Account is owed its one unprompted offer to upload (v3 Req 36.6)
 *
 * **The answer is produced by claiming it, not by reading it.** `POST /api/account/upload-prompt`
 * returns `true` to exactly one caller ever; every later call — another tab, another device, the
 * next sign-in — gets `false`. A `GET` that only reported would leave the marking to a second
 * request nobody can guarantee arrives.
 */
export interface UploadPromptClaim {
  shouldPrompt: boolean;
}

/**
 * What a refused save says beyond its message (v3 Req 33.8)
 *
 * Two shapes rather than a free-text message, because the client has to *act*: a conflict needs the
 * revision it is behind so a reload can be offered, and a shape failure needs the fields so the
 * User can be told which part of their ruleset the server could not read.
 */
export type RulesetSaveRefusal = ErrorBody & ErrorDetails;
