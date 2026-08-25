/**
 * The Auth_Sessions this Account holds, and revoking them (TICKET-AUTH-04)
 *
 * The `useXManager` shape applied to v3 Req 48.7's second half: an Account can see what it holds
 * and can end any of it. **Revocation is the point, not the list** — a session lasts up to ninety
 * days (D13), so "I signed in on a machine at the shop" needs an answer better than waiting.
 *
 * **The current session is marked rather than hidden.** Somebody looking for a session to end has
 * to be able to tell which one they are sitting in, and a list that quietly omits it is a list that
 * does not add up.
 *
 * **Validates: v3 Req 48.7**
 */

import { useCallback, useEffect, useState } from 'react';
import { authClient } from './authClient';

/** One Auth_Session, as much of it as a person needs to recognise one */
export interface ActiveSession {
  /** The token, which is also what revoking one names */
  token: string;
  /** When it was signed in — the one detail that reliably distinguishes two of them */
  createdAt: string;
  /** What the browser called itself, when it said */
  userAgent: string | null;
  /** True for the session this page is being read in */
  isCurrent: boolean;
}

/** What the account page needs */
export interface ActiveSessionsManager {
  sessions: ActiveSession[];
  isPending: boolean;
  error: string | null;
  /** End one session. The card offers this for the *other* sessions only — see the marker there */
  revoke: (token: string) => void;
  /** End every session this Account holds, including this one (v3 Req 48.7) */
  revokeAll: () => void;
}

/** What `/list-sessions` gives back, as much of it as this reads */
interface ListedSession {
  token: string;
  createdAt: string | Date;
  userAgent?: string | null;
}

/** The row a listing entry becomes */
function toActiveSession(row: ListedSession, currentToken: string | null): ActiveSession {
  return {
    token: row.token,
    createdAt: new Date(row.createdAt).toISOString(),
    userAgent: row.userAgent ?? null,
    isCurrent: currentToken !== null && row.token === currentToken,
  };
}

/**
 * Drive the active-sessions view
 *
 * @returns The sessions, and the two ways to end them
 */
export function useActiveSessions(): ActiveSessionsManager {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [listed, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ]);

      const currentToken = (current.data?.session as { token?: string } | undefined)?.token ?? null;
      setSessions(
        ((listed.data ?? []) as ListedSession[]).map((row) => toActiveSession(row, currentToken))
      );
    } catch {
      // Same reasoning as `useSocialProviders`: an Account that cannot reach the list is not
      // helped by a red box about it, and the page's other card still works
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    (token: string) => {
      setError(null);
      void authClient
        .revokeSession({ token })
        .then((result) => {
          if (result.error) {
            setError(result.error.message ?? 'Could not end that session. Try again.');
            return;
          }
          return load();
        })
        .catch(() => setError('Could not reach the server. Check your connection and try again.'));
    },
    [load]
  );

  const revokeAll = useCallback(() => {
    setError(null);
    // **Including this browser's own**, which is what "everywhere" has to mean to be worth having:
    // the case it exists for is a device you no longer hold, and one you cannot name from here.
    void authClient
      .revokeSessions()
      .then((result) => {
        if (result.error) {
          setError(result.error.message ?? 'Could not sign out everywhere. Try again.');
          return;
        }
        // A full load rather than a router navigation: every cookie is gone, so the next thing the
        // page does has to be re-asking the server who it is talking to
        window.location.replace('/');
      })
      .catch(() => setError('Could not reach the server. Check your connection and try again.'));
  }, []);

  return { sessions: sessions ?? [], isPending: sessions === null, error, revoke, revokeAll };
}
