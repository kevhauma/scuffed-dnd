/**
 * The wire ↔ row boundary for a Game_Session (TICKET-GAM-01)
 *
 * `rulesetPayloads.ts`'s counterpart, one aggregate over. Five route modules sit beside this one and
 * each is a guard, a call and a shape, because everything they have in common is here: what a
 * session looks like on the wire, how a request names one, how a pinned Snapshot is opened, and the
 * one rule that is *about* the session's state rather than about who is asking — an archived table
 * accepts no writes.
 *
 * **The wire shapes live in `#shared/types/api`** for RUL-01's reason: the client branches on them.
 *
 * **Validates: v3 Req 37.2, 37.5**
 */

import { toDisplayConfiguration } from '#shared/engine/formula/references';
import { assertSupportedSchemaVersion, SchemaVersionError } from '#shared/services/importExport';
import type { GameSessionSummary, MemberRole } from '#shared/types/api';
import { SESSION_STATUS } from '#shared/types/api';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { conflict } from '../../http/appError';
import type {
  GameSessionRow,
  GameSessionSummaryRow,
} from '../../repositories/gameSessionRepository';

/**
 * A row as a summary
 *
 * Takes either shape, because create and archive have a whole row in hand and the listing
 * deliberately does not — and both owe the client the same eight fields plus the caller's role.
 *
 * **`role` is a parameter rather than a column**, because it is not a property of the session: it is
 * what *this* Account is at it. The listing joins it in; a single-session route has it from the
 * guard, which returned the membership for exactly this reason.
 *
 * **Named for the aggregate rather than `toSummary`**, which is what `rulesetPayloads` calls its
 * own: two exports sharing a spelling in two barrels are two things an `export *` can resolve
 * ambiguously between, and `fallow` reports it as a duplicate export.
 *
 * @param row The stored session, with or without its Snapshot
 * @param role What the asking Account is at this table
 * @returns What goes on the wire
 */
export function toSessionSummary(
  row: GameSessionRow | GameSessionSummaryRow,
  role: MemberRole
): GameSessionSummary {
  return {
    id: row.id,
    rulesetId: row.rulesetId,
    name: row.name,
    status: row.status,
    role,
    snapshotTakenAt: row.snapshotTakenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * What a session calls itself in a refusal — the one thing its name rule does not share
 *
 * Exported as the noun rather than wrapped in a `nameFrom` of its own, which is what this was until
 * `fallow` pointed out that a second `nameFrom` beside `rulesetPayloads`'s is a duplicate export two
 * barrels away from resolving ambiguously. One caller does not earn a wrapper anyway:
 * `createSession` says `requiredName(body, SESSION_SUBJECT)` and reads better for it.
 */
export const SESSION_SUBJECT = 'game session';

/** The collection every session id sits one segment under */
const SESSIONS_PREFIX = '/api/sessions/';

/**
 * Which session a path named
 *
 * `rulesetIdFrom`'s twin, and deliberately a second small function rather than a shared one
 * parameterised by prefix: the two are four lines each, and a `idFrom(url, prefix)` would be an
 * abstraction whose only content is the thing that differs. **Two shapes are real** —
 * `/api/sessions/:id` and `/api/sessions/:id/<action>` — and nothing deeper is.
 *
 * @param url The request URL
 * @returns The id segment, or an empty string when the path has none
 */
export function sessionIdFrom(url: URL): string {
  if (!url.pathname.startsWith(SESSIONS_PREFIX)) return '';

  const [id, ...rest] = url.pathname.slice(SESSIONS_PREFIX.length).split('/');

  return rest.length <= 1 ? id : '';
}

/**
 * The Snapshot a session plays against, in the form a client reads (v3 Req 37.2)
 *
 * **The Snapshot, never the Ruleset.** That is D7 as a function: nothing in `src/server/` loads a
 * ruleset by a session's `ruleset_id` to evaluate a rule, and this is the only way a session's rules
 * are obtained. The column is a copy taken at creation, so a DM's later tinkering is not in it.
 *
 * The version gate and the display translation are the same pair `documentOf` applies to a stored
 * ruleset — a **409**, because a caller who owns nothing wrong has been refused by the state of a
 * row they are allowed to read.
 *
 * @param row The stored session
 * @returns Its Snapshot with references spelled out
 * @throws {AppError} 409 when the Snapshot is at a schema version this build does not read
 */
export function snapshotOf(row: GameSessionRow): Configuration {
  try {
    assertSupportedSchemaVersion(row.snapshotSchemaVersion);
  } catch (error) {
    if (error instanceof SchemaVersionError) {
      throw conflict(
        `${error.message} (This session's rules were pinned at schema version ` +
          `${String(error.foundVersion)}; this build reads version ${SUPPORTED_SCHEMA_VERSION}.)`
      );
    }
    throw error;
  }

  return toDisplayConfiguration(JSON.parse(row.snapshot) as Configuration);
}

/**
 * A session that still accepts writes (v3 Req 37.5)
 *
 * **A 409, not a 404 and not a 403.** The caller may read this table — they are a Member, the guard
 * said so — and nothing about their request is malformed. What refuses them is the *state* of the
 * resource, which is exactly what a conflict is, and it is the same status a stale revision gets on
 * a ruleset for the same reason. Saying so leaks nothing they did not already know.
 *
 * Called by every write route on a session and by none of the reads, which is what makes *"archived
 * reads but accepts no writes"* a line of code per write rather than a promise.
 *
 * @param row The session being written to
 * @returns The same row, now known to be active
 * @throws {AppError} 409 when the session has been archived
 */
export function requireActive(row: GameSessionRow): GameSessionRow {
  if (row.status === SESSION_STATUS.ARCHIVED) {
    throw conflict(
      'This game session has been archived, so it no longer accepts changes. Everything in it is ' +
        'still here to read.'
    );
  }

  return row;
}
