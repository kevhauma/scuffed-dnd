/**
 * The code one table is handing out, and the two things a DM does to it (TICKET-GAM-02)
 *
 * **Issue, reissue and revoke are two routes and three verbs**, because reissuing *is* issuing —
 * `POST` revokes whatever was live and inserts a replacement in one transaction, so there is never a
 * moment with two live codes or none. The DM's surface offers them as *New code* and *Take it back*,
 * which is what those two acts are called at a table.
 *
 * **The invitation arrives with the session**, not from a route of its own: `GET /api/sessions/:id`
 * carries `invite` for a DM and omits it for everybody else. So this hook opens the session to read
 * one, and re-opens it after a write rather than trusting what it sent.
 *
 * **Validates: v3 Req 38.1, 38.2**
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameSessionDocument, SessionInvite } from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';

/** Where a session's own routes live */
const SESSIONS_PATH = '/api/sessions';

/** What the DM's invite surface needs */
export interface SessionInviteState {
  /**
   * The live invitation, or `null` when this table has none — or when the caller is not its DM
   *
   * Carries `expiresAt` beside the code, because a client handed only the string cannot tell a live
   * invitation from a fortnight-old one and would offer *Copy link* for both.
   */
  invite: SessionInvite | null;
  /** True while the first read is in flight */
  isPending: boolean;
  /** True while a write is on the wire, so neither button can be pressed twice */
  isBusy: boolean;
  error: string | null;
  /** Issue a code, retiring whatever was live (v3 Req 38.2) */
  issue: () => void;
  /** Take the live code back without replacing it */
  revoke: () => void;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive one table's invitation
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The invitation and the two ways to change it
 */
export function useSessionInvite(sessionId: string | null): SessionInviteState {
  const [invite, setInvite] = useState<SessionInvite | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Which table the surface is actually showing
   *
   * **The staleness guard `useJoinSession` has and this did not** (the GAM-02 review). A request
   * cannot be cancelled, so expanding table A and then table B in quick succession can land A's
   * answer after B's — and `setInvite` would put A's code under B's panel, which is the one kind of
   * mistake this surface must not make.
   */
  const showing = useRef<string | null>(sessionId);
  showing.current = sessionId;

  const load = useCallback(async (id: string) => {
    setIsPending(true);

    try {
      const session = await apiRequest<GameSessionDocument>(`${SESSIONS_PATH}/${id}`);

      if (showing.current !== id) return;

      // Absent for a player and for a DM with no live code — both read as "there is nothing to show
      // you", which is the truth in each case
      setInvite(session.invite ?? null);
      setError(null);
    } catch (cause) {
      if (showing.current === id) setError(messageOf(cause));
    } finally {
      if (showing.current === id) setIsPending(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setInvite(null);
      setError(null);
      return;
    }

    void load(sessionId);
  }, [sessionId, load]);

  /** Run a write, then re-read rather than trusting what the write said */
  const write = useCallback(
    async (act: (id: string) => Promise<unknown>) => {
      if (!sessionId || isBusy) return;

      setIsBusy(true);
      setError(null);

      try {
        await act(sessionId);
        await load(sessionId);
      } catch (cause) {
        setError(messageOf(cause));
      } finally {
        setIsBusy(false);
      }
    },
    [sessionId, isBusy, load]
  );

  return {
    invite,
    isPending,
    isBusy,
    error,
    issue: () => {
      void write((id) => apiSend<SessionInvite>(`${SESSIONS_PATH}/${id}/invite`, 'POST', {}));
    },
    revoke: () => {
      void write((id) => apiRequest<void>(`${SESSIONS_PATH}/${id}/invite`, { method: 'DELETE' }));
    },
  };
}
