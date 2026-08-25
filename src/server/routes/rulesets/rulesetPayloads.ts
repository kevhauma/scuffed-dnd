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

import { assertSupportedSchemaVersion, SchemaVersionError } from '#shared/services/importExport';
import type { RulesetSummary } from '#shared/types/api';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { badRequest, conflict } from '../../http/appError';
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

/** The longest a ruleset name may be — a column with no bound is a column somebody fills */
const MAX_NAME_LENGTH = 120;

/**
 * The name a request body asked for
 *
 * **Uniqueness is deliberately not checked** (TICKET-RUL-01's notes): two rulesets called
 * "Ducklets" is the User's business, and the id is the identity as it is everywhere else here.
 * What is checked is that there is a name at all, because a blank row in the list is one the User
 * cannot tell from any other.
 *
 * @param body The parsed request body
 * @returns The trimmed name
 * @throws {AppError} 400 when it is absent, blank or too long
 */
export function nameFrom(body: unknown): string {
  const value = (body as { name?: unknown } | null)?.name;

  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest('A ruleset needs a name.');
  }

  const name = value.trim();

  if (name.length > MAX_NAME_LENGTH) {
    throw badRequest(`A ruleset name is at most ${MAX_NAME_LENGTH} characters.`);
  }

  return name;
}

/** The collection every ruleset id sits one segment under */
const RULESETS_PREFIX = '/api/rulesets/';

/**
 * Which ruleset a path named
 *
 * `/api/rulesets/:id` — spelled against the collection's own path rather than as a segment index,
 * so `/api/rulesets/abc/copy` (RUL-03) and `/api/somewhere/else` both come back empty instead of
 * yielding a plausible-looking id.
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
  const [id, ...rest] = url.pathname.replace(RULESETS_PREFIX, '').split('/');

  // Anything that is not exactly one segment under the collection is not a ruleset id. The router
  // has already matched the shape in production, so this only fires for a handler called directly
  // in a test — where an empty id is a 404 like any other unknown one rather than a crash.
  return url.pathname.startsWith(RULESETS_PREFIX) && rest.length === 0 ? id : '';
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
