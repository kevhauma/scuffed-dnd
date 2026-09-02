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
import type { GameSessionSummary, MemberRole, MembershipEventPayload } from '#shared/types/api';
import { SESSION_EVENT, SESSION_STATUS } from '#shared/types/api';
import { type Configuration, SUPPORTED_SCHEMA_VERSION } from '#shared/types/config';
import { conflict } from '../../http/appError';
import type { NewEvent } from '../../repositories/eventRepository';
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

/** The one sub-collection that carries an id of its own (TICKET-GAM-04) */
const MEMBERS_SEGMENT = 'members';

/**
 * Which session a path named
 *
 * `rulesetIdFrom`'s twin, and deliberately a second small function rather than a shared one
 * parameterised by prefix: the two are four lines each, and a `idFrom(url, prefix)` would be an
 * abstraction whose only content is the thing that differs.
 *
 * **Three shapes are real** — `/api/sessions/:id`, `/api/sessions/:id/<action>` and, since
 * TICKET-GAM-04, `/api/sessions/:id/members/:accountId`. Nothing else is, and the third is named
 * rather than admitted as *any two-deep path*: a depth cap alone would read `/api/sessions/abc/x/y`
 * as naming session `abc`, which is a plausible-looking id built out of nonsense. In production the
 * router has already matched a real route before any handler runs, so a miss here only happens for a
 * handler called directly in a test — where an empty id is a 404 like any other unknown one rather
 * than a crash.
 *
 * @param url The request URL
 * @returns The id segment, or an empty string when the path has none
 */
export function sessionIdFrom(url: URL): string {
  if (!url.pathname.startsWith(SESSIONS_PREFIX)) return '';

  const [id, ...rest] = url.pathname.slice(SESSIONS_PREFIX.length).split('/');

  if (rest.length <= 1) return id;

  return rest.length === 2 && rest[0] === MEMBERS_SEGMENT ? id : '';
}

/**
 * Which Member a path named (TICKET-GAM-04)
 *
 * Only `/api/sessions/:id/members/:accountId` carries one, so anything else is an empty string and
 * the route it reaches will refuse it like any other unknown Member.
 *
 * @param url The request URL
 * @returns The account id segment, or an empty string when the path names no Member
 */
export function memberAccountIdFrom(url: URL): string {
  if (!url.pathname.startsWith(SESSIONS_PREFIX)) return '';

  const [, collection, accountId, ...rest] = url.pathname.slice(SESSIONS_PREFIX.length).split('/');

  return collection === MEMBERS_SEGMENT && rest.length === 0 ? (accountId ?? '') : '';
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

/**
 * *Somebody took a seat at this table* (TICKET-LIVE-04, v3 Req 44.3)
 *
 * **Here rather than in either seating route, and the reason is `routeGuards.test.ts`.** That scan
 * fails any handler naming an owned identifier without calling a resource guard, and `redeemInvite`
 * is the one route in the milestone that legitimately calls none — redeeming a code *is* the act of
 * becoming a Member, so there is nothing yet to be guarded against. It stays clean by never spelling
 * `sessionId`, which is the same reason `NewSessionMember` takes the loaded **row**; an Event
 * literal in that handler would have spelled it and turned a real check into a false alarm somebody
 * would have been tempted to exempt.
 *
 * That both seating paths can then share one description is a bonus rather than the motive: an
 * addressed invitation and a shared code produce the **identical** Event, because what the table is
 * told is *who is here now* and not how they came to be invited.
 *
 * **The payload is an Account id and nothing else** — no name, the rule every payload on this log
 * keeps, so a rename cannot leave the log calling somebody by a name they no longer have.
 *
 * @param session The table they sat down at, as a row — never an id read from a request
 * @param accountId Who sat down; they are also the actor, since joining is something you do
 * @param now Epoch milliseconds, shared with the membership row written in the same transaction
 * @returns The Event, ready for `recordEvent`
 */
export function joinedTheTable(session: GameSessionRow, accountId: string, now: number): NewEvent {
  const payload: MembershipEventPayload = { accountId };

  return {
    id: crypto.randomUUID(),
    sessionId: session.id,
    actorAccountId: accountId,
    type: SESSION_EVENT.MEMBER_JOINED,
    payload: JSON.stringify(payload),
    now,
  };
}
