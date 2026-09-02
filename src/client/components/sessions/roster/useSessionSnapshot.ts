/**
 * The rules one table plays by, read without opening them (TICKET-DM-04)
 *
 * The roster derives a level, a point budget and a set of pools per character, and every one of those
 * is a question about the session's **Snapshot** (D7) rather than about any Ruleset. This is how it
 * gets one.
 *
 * ## Why this is not `configStore.openSessionSnapshot`
 *
 * That action exists and does more than this needs: it makes the Snapshot **the open ruleset**, which
 * is what the creation wizard wants and what Configuration mode then shows. Expanding a row on
 * `/sessions` to glance at who is at a table must not change which ruleset the User is editing two
 * tabs over — a surface that reads something should not move the app's global state to do it. So the
 * Snapshot lives in this hook's own state, is scoped to the open row, and goes when the row closes.
 *
 * That also keeps `rulesetSync`'s refusal honest: `RULESET_HOME.SESSION` is a home `persistRuleset`
 * declines to write to, and a roster holding a Snapshot it never opened cannot be the thing that
 * tests it.
 *
 * **The fifth surface keyed on the open row**, over [`useSessionResource`](../useSessionResource.ts)
 * like the four before it — so the staleness guard (an answer for a table that is no longer open is
 * discarded) and the *404 means you cannot see this any more* rule are the ones GAM-04 extracted
 * rather than a fifth copy.
 *
 * **Validates: v3 Req 37.5, 49.8**
 */

import type { GameSessionDocument } from '#shared/types/api';
import type { Configuration } from '#shared/types/config';
import { SESSIONS_PATH, useSessionResource } from '../useSessionResource';

/** What the roster needs in order to derive anything at all */
export interface SessionSnapshotState {
  /** The rules this table plays by, or `null` before the read lands */
  snapshot: Configuration | null;
  /** True while the first read is in flight */
  isPending: boolean;
  error: string | null;
  /**
   * Read the rules again
   *
   * What the roster's feed calls on a Snapshot refresh (`SESSION_EVENT.SNAPSHOT_REFRESHED`) — the one
   * Event that moves the rules underneath every number on the surface. It is the same read this hook
   * opened with, for the reason `useSessionResource.reload`'s own docblock gives.
   */
  reload: () => Promise<void>;
}

/**
 * Read one table's Snapshot
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The rules it plays by
 */
export function useSessionSnapshot(sessionId: string | null): SessionSnapshotState {
  const { data, isPending, error, reload } = useSessionResource<GameSessionDocument>(
    sessionId,
    (id) => `${SESSIONS_PATH}/${id}`
  );

  return {
    snapshot: data?.snapshot ?? null,
    isPending,
    error,
    reload,
  };
}
