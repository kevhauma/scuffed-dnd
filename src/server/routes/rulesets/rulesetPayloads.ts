/**
 * The wire ↔ row boundary for a Ruleset (TICKET-RUL-01)
 *
 * Four route modules sit beside this one and each is a handful of lines, because everything they
 * have in common is here: what a ruleset looks like on the wire, how a request names one, and how a
 * stored document is opened.
 *
 * **The wire shapes themselves live in `#shared/types/api`** (TICKET-RUL-01's review), because the
 * client branches on them and a second declaration on that side is one that can drift silently.
 * What is here is the *translation* — a row into a summary, a body into a name, a path into an id —
 * which is server work and stays server work.
 *
 * **Validates: v3 Req 33.1, 33.4, 33.8**
 */

import { toDisplayConfiguration } from '#shared/engine/formula/references';
import {
  assertSupportedSchemaVersion,
  importParsedConfiguration,
  SchemaVersionError,
  serializeConfiguration,
  ValidationError,
  validateConfigurationShape,
} from '#shared/services/importExport';
import type { RulesetSummary } from '#shared/types/api';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { type AppError, badRequest, conflict } from '../../http/appError';
import type { RulesetRow, RulesetSummaryRow } from '../../repositories/rulesetRepository';

/**
 * A row as a summary
 *
 * Takes either shape, because create and rename have a whole row in hand and the listing
 * deliberately does not — and both owe the client the same seven fields.
 *
 * @param row The stored ruleset, with or without its document
 * @returns What goes on the wire
 */
export function toSummary(row: RulesetRow | RulesetSummaryRow): RulesetSummary {
  return {
    id: row.id,
    name: row.name,
    schemaVersion: row.schemaVersion,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * What a ruleset calls itself in a refusal — the one thing its name rule does not share
 *
 * The rule itself was written out here until TICKET-GAM-01 wrote a second copy for sessions and
 * `fallow dupes` measured the two at 25 identical lines; it lives in
 * [`entityName.ts`](../entityName.ts) now, along with the reasoning and with why uniqueness is
 * deliberately not among the things checked. **The noun is exported rather than wrapped in a
 * `nameFrom` of its own**, matching `SESSION_SUBJECT` next door: a one-line delegation under a
 * twelve-line docblock is not an abstraction, and two idioms for one call is worse than either.
 */
export const RULESET_SUBJECT = 'ruleset';

/** The collection every ruleset id sits one segment under */
const RULESETS_PREFIX = '/api/rulesets/';

/**
 * Which ruleset a path named
 *
 * Spelled against the collection's own path rather than as a segment index. **Two shapes are real**
 * — `/api/rulesets/:id` and `/api/rulesets/:id/<action>`, the second of which arrived with RUL-03's
 * `/copy` — and nothing deeper is, so `/api/somewhere/else` and `/api/rulesets/a/b/c` both come back
 * empty rather than yielding a plausible-looking id.
 *
 * **A handler reads it rather than being handed it**, deliberately. The alternative was a `params`
 * channel through `RequestScope`, and `pipeline.test.ts` asserts that exactly two modules name that
 * type — it is the seam that lets a caller say *who is asking*, and widening it to carry path
 * segments would make that assertion unmaintainable for a convenience.
 *
 * @param url The request URL
 * @returns The id segment, or an empty string when the path has none
 */
export function rulesetIdFrom(url: URL): string {
  if (!url.pathname.startsWith(RULESETS_PREFIX)) return '';

  const [id, ...rest] = url.pathname.slice(RULESETS_PREFIX.length).split('/');

  // `/api/rulesets/:id` and `/api/rulesets/:id/<action>` are both real shapes — RUL-03's `/copy` is
  // the first of the second kind — and nothing deeper is. The router has already matched one of
  // them in production, so a miss here only happens for a handler called directly in a test, where
  // an empty id is a 404 like any other unknown one rather than a crash.
  return rest.length <= 1 ? id : '';
}

/**
 * The stored document of a ruleset this build can still write (v3 Req 33.4)
 *
 * **The version gate is the import path's**, reused rather than restated: `assertSupportedSchemaVersion`
 * lives in `#shared/services/importExport` and throws the same `SchemaVersionError` the browser's
 * Import button produces, so a User who meets this refusal twice meets one message. The version is
 * appended because RUL-01 asks for it stated and the shared sentence does not name a number.
 *
 * A **409 rather than a 400**: the caller's request was fine, and what refuses it is the state of a
 * row they own. They already passed an ownership check, so naming the reason leaks nothing.
 *
 * @param row The stored ruleset
 * @returns Its document, in **stored** form — id-resolved, exactly as the column holds it
 * @throws {AppError} 409 when the row is at a schema version this build does not read
 */
export function documentOf(row: RulesetRow): Configuration {
  try {
    assertSupportedSchemaVersion(row.schemaVersion);
  } catch (error) {
    if (error instanceof SchemaVersionError) {
      throw conflict(
        `${error.message} (This ruleset is stored at schema version ${String(error.foundVersion)}; ` +
          `this build reads version ${SUPPORTED_SCHEMA_VERSION}.)`
      );
    }
    throw error;
  }

  return JSON.parse(row.data) as Configuration;
}

/**
 * The same document, in the form a client edits (TICKET-RUL-02)
 *
 * `toDisplayConfiguration` re-spells every formula, racial modifier and material bonus with
 * whatever the entity it points at is *currently called*. That is what makes a rename harmless: the
 * column stores ids, so nothing is identified by a spelling, and this puts the spellings back on
 * the way out.
 *
 * **The server is a third boundary of the same kind** as `client/services/storage.ts` and the
 * import/export path (TICKET-REF-01), not a new kind — the pair is the same pair, applied at the
 * wire instead of at a file.
 *
 * @param row The stored ruleset
 * @returns Its document with references spelled out
 * @throws {AppError} 409 when the row is at a schema version this build does not read
 */
export function displayDocumentOf(row: RulesetRow): Configuration {
  return toDisplayConfiguration(documentOf(row));
}

/**
 * A `Configuration` a client sent, ready to store (v3 Req 33.4, 33.5)
 *
 * Three gates in the order the browser's own Import button runs them, and for the same reason it
 * runs them that way: **the version gate first**, so a document from another build is refused whole
 * rather than reported field by field, then the shape check, then serialisation.
 *
 * **The version refusal here is a 400, not the 409 {@link documentOf} throws**, and the difference
 * is which document is at the wrong version. There, a *stored row* the caller owns is unreadable —
 * the state of the resource refuses them, and there is nothing wrong with what they sent. Here the
 * caller **sent** the wrong thing. The client maps `conflict` to *somebody else wrote in between*,
 * which has a different remedy (reload) from *this build cannot read that file* (refresh the app,
 * or export it from a build that can), so the two cannot share a code.
 *
 * **Nothing is persisted when any of them fails.** The caller gets the JSON text or an `AppError`,
 * so there is no half-applied state to reason about — the write either happens with a validated
 * document or does not happen.
 *
 * The failing fields ride along on the refusal because a client has to be able to say *which part
 * of your ruleset could not be read*; a bare "validation failed" is a refusal nobody can act on.
 *
 * @param submitted Whatever arrived in the request body's `configuration`
 * @returns The document as JSON text in **stored** form, ready for the column
 * @throws {AppError} 400 for the wrong schema version and for a shape the server cannot read
 */
export function storableDocument(submitted: unknown): string {
  try {
    assertSupportedSchemaVersion((submitted as Record<string, unknown> | null)?.schemaVersion);
  } catch (error) {
    throw wrongVersionSent(error);
  }

  const validation = validateConfigurationShape(submitted);

  if (!validation.isValid) {
    throw wrongShapeSent(validation.errors);
  }

  return serializeConfiguration(submitted as Configuration);
}

/**
 * A document the caller sent at a version this build does not read, as a refusal
 *
 * The **400**, not the 409 {@link documentOf} throws — see that docblock for which document is at
 * the wrong version in each case. Extracted so `PUT` and `POST /api/rulesets/import` refuse an old
 * file with one sentence rather than two that agree today (TICKET-IO-04).
 *
 * @param error Whatever the gate threw
 * @returns The refusal to throw, or the original error when it was not a version failure
 */
function wrongVersionSent(error: unknown): unknown {
  if (!(error instanceof SchemaVersionError)) return error;

  return badRequest(
    `${error.message} (That ruleset states schema version ${String(error.foundVersion)}; ` +
      `this build reads version ${SUPPORTED_SCHEMA_VERSION}.)`
  );
}

/**
 * A document whose shape the server could not read, as a refusal
 *
 * @param fields The validator's own words, unedited: it names the field and what was wrong with it,
 *   and rewording them here would be a second vocabulary for the same failures
 * @returns The refusal to throw
 */
function wrongShapeSent(fields: string[]): AppError {
  return badRequest('That ruleset is not a shape this server can read, so nothing was saved.', {
    fields,
  });
}

/**
 * A `Configuration` a client asked the server to **import** (v3 Req 35.1, 35.2)
 *
 * The browser's own import chain, run server-side: `importParsedConfiguration` gates the version,
 * checks the shape — retired fields included — mints the reference ids an authored file may omit,
 * and hands back the display form. **The same function the browser
 * calls**, which is what makes "each produces its existing distinct message on both paths" a fact
 * about one implementation rather than a promise about two.
 *
 * The difference from {@link storableDocument}, and the reason both exist: a `PUT` carries a
 * document this app itself produced moments ago and must round-trip it untouched, while an import
 * carries a *file* — possibly hand-edited, possibly older than reference ids — and has to be
 * brought up to the current shape before anything looks at it.
 *
 * **Nothing is persisted when any gate fails.** The caller gets an `AppError`, and the route has not
 * reached an insert.
 *
 * @param submitted Whatever arrived in the request body's `configuration`
 * @returns The document in display form, ready to be copied and stored
 * @throws {AppError} 400 for the wrong schema version and for a shape the server cannot read
 */
export function importedDocument(submitted: unknown): Configuration {
  try {
    return importParsedConfiguration(submitted);
  } catch (error) {
    if (error instanceof ValidationError) throw wrongShapeSent(error.errors);
    throw wrongVersionSent(error);
  }
}
