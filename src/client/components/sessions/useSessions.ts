/**
 * The tables this Account sits at (TICKET-GAM-02)
 *
 * `useAccountRulesets`'s counterpart one aggregate over, with one difference worth stating: **there
 * is no `enabled`**. That hook has one because `/rulesets` is deliberately open and really does
 * render signed out (D6); `/sessions` is protected, so `RequireAccount` has already established an
 * Account before this mounts. A flag whose only reachable value is `true` is a branch nobody can
 * test — the GAM-02 review found three components threading one around.
 *
 * Every write reports whether it landed, so a surface only closes over a change that happened.
 *
 * **The invite code is not fetched here.** A listing carries no Snapshot and no code; a DM opening
 * one table gets both from `GET /api/sessions/:id`. That keeps *the code is the DM's* a property of
 * one route rather than of every place a session is named.
 *
 * **Validates: v3 Req 32.1, 37.1, 38.2**
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  GameSessionCreateRequest,
  GameSessionListing,
  GameSessionSummary,
} from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';

/** Where `/api/sessions` lives — a relative path, because there is only ever one origin (D1) */
const SESSIONS_PATH = '/api/sessions';

/** What the sessions surface needs */
export interface SessionsState {
  sessions: GameSessionSummary[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  error: string | null;
  /** Start a table from a ruleset this Account owns; reports whether it landed */
  create: (request: GameSessionCreateRequest) => Promise<boolean>;
  /** Read the listing again, for a write made somewhere else */
  reload: () => void;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive the sessions list
 *
 * @returns The listing and the actions
 */
export function useSessions(): SessionsState {
  const [sessions, setSessions] = useState<GameSessionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions((await apiRequest<GameSessionListing>(SESSIONS_PATH)).sessions);
      // Cleared on success — the sticky-error defect IO-04's review found on the ruleset listing,
      // not repeated here
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    sessions: sessions ?? [],
    isPending: sessions === null,
    error,
    reload: useCallback(() => void load(), [load]),
    create: useCallback(
      async (request: GameSessionCreateRequest) => {
        setError(null);

        try {
          await apiSend(SESSIONS_PATH, 'POST', request);
          await load();
          return true;
        } catch (cause) {
          setError(messageOf(cause));
          return false;
        }
      },
      [load]
    ),
  };
}
