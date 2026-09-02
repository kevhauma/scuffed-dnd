/**
 * Reading and writing one thing that belongs to the open table (TICKET-GAM-04)
 *
 * **Extracted on the third instance, which is where the house rule says to.** `useSessionInvite`
 * (GAM-02), `useSessionInvitations` (GAM-03) and `useSessionMembers` (GAM-04) had grown the same
 * forty lines three times: a `showing` ref, a load guarded by it at three points, and a write that
 * sets busy, calls one action, re-reads, and reports whether it landed. `fallow audit` measured the
 * two halves at 22 and 15 identical lines across all three.
 *
 * **What is shared is the mechanism; what stays in each hook is what a write *means*.** This owns
 * *how* a request is made against the open session and *when* its answer may be believed. Issuing a
 * code, sending an invitation and handing a table over are three different acts and are still three
 * named functions in three files — each one line, spelled `write((id) => …)`.
 *
 * ## The two properties worth knowing about
 *
 * **A response for a table that is no longer open is discarded.** A request cannot be cancelled, so
 * expanding table A and then table B in quick succession can land A's answer after B's — and the
 * consequence is not a flicker, it is one table's people or one table's code under another table's
 * heading. The `showing` ref is compared before every state update, not only before the first.
 *
 * **A 404 is an answer, not a fault.** Every route this reads sits behind `requireMember` or
 * `requireDM`, so the one way to be refused a table you were reading a moment ago is to have stopped
 * being able to see it — which is exactly what giving up your own seat does, and the re-read that
 * follows lands here every time. It clears what was on screen and says nothing, because the row is
 * about to leave the list and *not found* in red would report success as a failure. Every other
 * refusal is shown in the server's own words.
 *
 * **Validates: v3 Req 38.2, 38.4, 39.7**
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest } from '../../services/api';

/** Where a session's own routes live — a relative path, because there is one origin (D1) */
export const SESSIONS_PATH = '/api/sessions';

/** What every surface keyed on the open table gets */
export interface SessionResource<T> {
  /** The last answer believed to be about the open table, or `null` */
  data: T | null;
  /** True while the first read is in flight */
  isPending: boolean;
  /** True while a write is on the wire, so no button can be pressed twice */
  isBusy: boolean;
  error: string | null;
  /**
   * Do something to this table, then re-read rather than trusting what the write said
   *
   * @param act What to send, given the open session's id
   * @returns Whether it landed — so a form clears, or a list reloads, only over a real change
   */
  write: (act: (sessionId: string) => Promise<unknown>) => Promise<boolean>;
  /**
   * Read it again, with nothing written first (TICKET-DM-04)
   *
   * The read half of {@link SessionResource.write}, exposed when the roster's live feed needed to
   * refetch after an Event it could not apply. **It is the same `load`**, so the staleness guard and
   * the *404 means you cannot see this any more* rule come with it — which is the whole point of
   * asking for this rather than putting an `apiRequest` in the feed. A second spelling of *what this
   * surface is made of* is the thing most likely to drift (TICKET-LIVE-02's lesson, applied one
   * aggregate over).
   *
   * Stable across renders, so a coalescing timer can hold it without rescheduling itself.
   *
   * @returns When the read has settled, however it settled — a refusal is reported through `error`
   */
  reload: () => Promise<void>;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive one resource belonging to the open table
 *
 * @param sessionId Which table, or `null` when no table is open
 * @param pathFor The route to read, given that id
 * @returns The answer and the way to change it
 */
export function useSessionResource<T>(
  sessionId: string | null,
  pathFor: (sessionId: string) => string
): SessionResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Which table the surface is actually showing */
  const showing = useRef<string | null>(sessionId);
  showing.current = sessionId;

  /** Held in a ref so `load` does not change identity when a caller passes an inline path builder */
  const route = useRef(pathFor);
  route.current = pathFor;

  const load = useCallback(async (id: string) => {
    setIsPending(true);

    try {
      const answer = await apiRequest<T>(route.current(id));

      if (showing.current !== id) return;

      setData(answer);
      setError(null);
    } catch (cause) {
      if (showing.current !== id) return;

      // See the header: being refused a table you could read a moment ago is *you cannot see this
      // any more*, which is a state rather than a failure
      if (cause instanceof ApiError && cause.status === 404) {
        setData(null);
        setError(null);
        return;
      }

      setError(messageOf(cause));
    } finally {
      if (showing.current === id) setIsPending(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setError(null);
      return;
    }

    void load(sessionId);
  }, [sessionId, load]);

  return {
    data,
    isPending,
    isBusy,
    error,
    reload: useCallback(async () => {
      if (!sessionId) return;

      await load(sessionId);
    }, [sessionId, load]),
    write: useCallback(
      async (act: (id: string) => Promise<unknown>) => {
        if (!sessionId || isBusy) return false;

        setIsBusy(true);
        setError(null);

        try {
          await act(sessionId);
          await load(sessionId);
          return true;
        } catch (cause) {
          setError(messageOf(cause));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      [sessionId, isBusy, load]
    ),
  };
}
