/**
 * Where a ruleset edit is persisted, and the debounce in front of the server (TICKET-RUL-02)
 *
 * **The one place the destination branches.** `useConfigStore`'s thirty-odd actions keep their
 * signatures and keep calling one `autoSave`; what changes here is where that write goes, and it
 * follows from which ruleset is open
 * ([D6](../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)).
 * A local ruleset persists to LocalStorage through `storage.ts` **exactly as it did in v2.0** — same
 * call, same failure handling, no network anywhere near it. An account ruleset goes to the server,
 * guarded by `revision`.
 *
 * **CLAUDE.md's rule is untouched**: persistence still belongs to the store action. This is the
 * service beneath it, the same way `storage.ts` always was.
 *
 * ## Why the server path is debounced and the local one is not
 *
 * A LocalStorage write is synchronous and costs microseconds, so v2.0 wrote on every keystroke and
 * nothing was wrong with that. A `PUT` carrying a 306 KB document is not that. So server saves are
 * **coalesced**: a burst of edits schedules one request carrying the *last* state, which is the
 * only state anybody wanted saved anyway.
 *
 * **Only one request is ever in flight per ruleset.** A save that lands while another is running
 * waits for it, because two overlapping writes would race the revision guard against each other and
 * the loser's refusal would be this module's own doing rather than another Owner's.
 *
 * **Validates: v3 Req 33.5, 33.6, 33.8, 36.2**
 */

import type { RulesetDocument, RulesetSaveRefusal } from '#shared/types/api';
import { ERROR_CODE } from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import { ApiError, apiRequest } from './api';
import { saveConfiguration } from './storage';

/** Where `/api/rulesets` lives — a relative path, because there is only ever one origin (D1) */
const RULESETS_PATH = '/api/rulesets';

/** Where the open ruleset lives — the two homes, as a value the store can hold */
export const RULESET_HOME = {
  BROWSER: 'browser',
  ACCOUNT: 'account',
} as const;

export type RulesetHomeKind = (typeof RULESET_HOME)[keyof typeof RULESET_HOME];

/**
 * Which ruleset is open, and therefore where its edits go
 *
 * A discriminated union rather than an id that is sometimes null: *the browser's ruleset* and *an
 * account ruleset that has no id yet* are not the same state, and a nullable id lets them be
 * confused. The account case carries the `revision` because every save states the one it is based
 * on, and the store adopts whatever comes back.
 */
export type RulesetSource =
  | { home: typeof RULESET_HOME.BROWSER }
  | { home: typeof RULESET_HOME.ACCOUNT; id: string; revision: number };

/** The browser's own ruleset — what a signed-out visitor always has open */
export const LOCAL_SOURCE: RulesetSource = { home: RULESET_HOME.BROWSER };

/** How a save ended */
export const SAVE_OUTCOME = {
  SAVED: 'saved',
  /** Somebody else wrote in between. The User's edit is untouched and needs a decision. */
  CONFLICT: 'conflict',
  /** The server refused the document, or could not be reached */
  FAILED: 'failed',
} as const;

/**
 * What happened to a save, and **which ruleset it happened to**
 *
 * The id is not bookkeeping. A request already on the wire cannot be aborted, so a save for the
 * ruleset that *was* open can resolve after another one has been opened — and a caller adopting a
 * revision without checking whose it is would point the new ruleset at the old one's revision and
 * manufacture a conflict on its next save. `rulesetId` is absent for the browser home, which has
 * neither an id nor a revision.
 */
export type SaveOutcome =
  | { outcome: typeof SAVE_OUTCOME.SAVED; rulesetId?: string; revision?: number }
  | { outcome: typeof SAVE_OUTCOME.CONFLICT; rulesetId: string; message: string }
  | { outcome: typeof SAVE_OUTCOME.FAILED; rulesetId?: string; message: string; fields?: string[] };

/**
 * How long a burst of edits is allowed to run before it becomes one request
 *
 * Long enough that typing a stat name is one save rather than twelve; short enough that closing
 * the tab a second after an edit has almost certainly already written. Both halves matter, and
 * neither is worth a setting.
 */
const SAVE_DELAY_MS = 800;

/** What is waiting to be sent, per ruleset id */
interface Pending {
  timer: ReturnType<typeof setTimeout>;
  /** The latest configuration, replaced by every edit that arrives before the timer fires */
  configuration: Configuration;
  /** The base revision the caller stated when it scheduled — a floor, see {@link baseRevisionFor} */
  scheduledRevision: number;
  /** Resolved for every caller whose state this save carries */
  waiting: ((outcome: SaveOutcome) => void)[];
}

const pending = new Map<string, Pending>();

/** Ids whose save is in flight right now — a second one waits rather than racing it */
const inFlight = new Set<string>();

/**
 * The revision the server last confirmed, per ruleset id
 *
 * **This is what stopped the module manufacturing its own conflicts.** A caller states the revision
 * it believes, but the store only learns the new one *after* a save resolves — so an edit made
 * while a save is in flight states the revision from before that save, and the next `PUT` would go
 * out one behind and be refused. Nobody else edited anything; the refusal would be this module's,
 * which is precisely what its one-write-in-flight rule exists to prevent and did not.
 *
 * Cleared with everything else by {@link cancelPendingSaves}, because a confirmed revision for a
 * ruleset nobody is editing any more is a number nobody should be writing against.
 */
const confirmedRevision = new Map<string, number>();

/**
 * What a save should state as its base
 *
 * The later of what the caller believed and what the server last confirmed. The caller's number is
 * right on a first save and after a reload; the confirmed one is right whenever a save has landed
 * since the caller last heard.
 */
function baseRevisionFor(id: string, scheduled: number): number {
  return Math.max(scheduled, confirmedRevision.get(id) ?? 0);
}

/**
 * Persist an edit to whichever home the ruleset lives in
 *
 * @param source Which ruleset is open
 * @param config The ruleset as it now stands
 * @returns What happened. The **local** path resolves synchronously-shaped: it either wrote or threw
 *   from `storage.ts`, exactly as before, and the caller handles that as it always has
 */
export function persistRuleset(source: RulesetSource, config: Configuration): Promise<SaveOutcome> {
  if (source.home === RULESET_HOME.BROWSER) {
    // Unchanged from v2.0, deliberately down to the throw: `storage.ts` reports a full or
    // unwritable store by throwing, and `configStore`'s `autoSave` has caught that since CR-11
    saveConfiguration(config);
    return Promise.resolve({ outcome: SAVE_OUTCOME.SAVED });
  }

  return scheduleSave(source.id, source.revision, config);
}

/**
 * Queue a server save, coalescing it with anything already waiting
 *
 * @param id Which ruleset
 * @param revision What the caller believes it is
 * @param configuration The state to save
 * @returns What happened, once the request this state rode on has finished
 */
function scheduleSave(
  id: string,
  revision: number,
  configuration: Configuration
): Promise<SaveOutcome> {
  return new Promise<SaveOutcome>((resolve) => {
    const existing = pending.get(id);

    if (existing) {
      // The timer restarts and the state is replaced: a burst of edits produces one request
      // carrying the last of them, which is the only one anybody wanted saved
      clearTimeout(existing.timer);
      existing.configuration = configuration;
      existing.scheduledRevision = Math.max(existing.scheduledRevision, revision);
      existing.waiting.push(resolve);
      existing.timer = setTimeout(() => void flush(id), SAVE_DELAY_MS);
      return;
    }

    pending.set(id, {
      configuration,
      scheduledRevision: revision,
      waiting: [resolve],
      timer: setTimeout(() => void flush(id), SAVE_DELAY_MS),
    });
  });
}

/**
 * Send whatever is waiting for one ruleset
 *
 * The base revision is worked out **at send time** rather than captured when the edit was
 * scheduled, which is the fix for the module's own conflicts — see {@link confirmedRevision}.
 *
 * @param id Which ruleset
 */
async function flush(id: string): Promise<void> {
  const queued = pending.get(id);
  if (!queued) return;

  // A save is already on the wire. Re-arm rather than send: two overlapping writes would race the
  // revision guard against *each other*, and the loser's conflict would be ours rather than a
  // second Owner's — a conflict the User cannot act on because nobody else did anything.
  if (inFlight.has(id)) {
    queued.timer = setTimeout(() => void flush(id), SAVE_DELAY_MS);
    return;
  }

  pending.delete(id);
  inFlight.add(id);

  const outcome = await sendSave(
    id,
    baseRevisionFor(id, queued.scheduledRevision),
    queued.configuration
  );

  if (outcome.outcome === SAVE_OUTCOME.SAVED && outcome.revision !== undefined) {
    confirmedRevision.set(id, outcome.revision);
  }

  inFlight.delete(id);
  for (const resolve of queued.waiting) resolve(outcome);
}

/** What a refusal body carries beyond its message */
function detailOf(error: ApiError): RulesetSaveRefusal {
  return (error.body ?? {}) as RulesetSaveRefusal;
}

/**
 * Put a ruleset, and turn whatever came back into an outcome
 *
 * @param id Which ruleset
 * @param revision The base revision
 * @param configuration What to save
 * @returns What happened
 */
async function sendSave(
  id: string,
  revision: number,
  configuration: Configuration
): Promise<SaveOutcome> {
  try {
    const saved = await apiRequest<RulesetDocument>(`${RULESETS_PATH}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ revision, configuration }),
    });

    return { outcome: SAVE_OUTCOME.SAVED, rulesetId: id, revision: saved.revision };
  } catch (error) {
    if (!(error instanceof ApiError)) {
      return {
        outcome: SAVE_OUTCOME.FAILED,
        rulesetId: id,
        message: 'Something went wrong saving that change.',
      };
    }

    if (error.code === ERROR_CODE.CONFLICT) {
      return { outcome: SAVE_OUTCOME.CONFLICT, rulesetId: id, message: error.message };
    }

    return {
      outcome: SAVE_OUTCOME.FAILED,
      rulesetId: id,
      message: error.message,
      fields: detailOf(error).fields,
    };
  }
}

/**
 * Read one ruleset from the Account (TICKET-RUL-02)
 *
 * Here rather than in the store, so that **every** `/api/rulesets/:id` request this app makes goes
 * through one module — the ticket's claim is that this is where a ruleset's transport lives, and a
 * store that fetched its own reads would have made that claim only half true. The store still owns
 * *what to do* with what comes back.
 *
 * @param id Which ruleset
 * @returns The document and its revision
 * @throws {ApiError} As `apiRequest` does — a refusal, or an unreachable server
 */
export function fetchRuleset(id: string): Promise<RulesetDocument> {
  return apiRequest<RulesetDocument>(`${RULESETS_PATH}/${id}`);
}

/**
 * Forget everything queued
 *
 * For a test between cases, and for the store when the open ruleset changes — a save aimed at a
 * ruleset nobody is editing any more is a write against a revision nobody is holding.
 */
export function cancelPendingSaves(): void {
  for (const queued of pending.values()) clearTimeout(queued.timer);
  pending.clear();
  inFlight.clear();
  confirmedRevision.clear();
}
