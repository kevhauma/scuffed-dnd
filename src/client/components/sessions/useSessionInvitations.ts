/**
 * The addressed invitations one table has sent (TICKET-GAM-03)
 *
 * `useSessionInvite`'s counterpart for the other kind of invitation, and the shape is deliberately
 * the same — keyed on the open session, re-reading after every write rather than trusting what the
 * write said, with the same staleness guard so an answer for table A cannot land under table B.
 *
 * **It is a separate hook rather than a second concern inside that one**, because the two are
 * different resources with different routes and different lifetimes: a table has exactly one shared
 * code, and an unbounded number of letters. Folding them together would make *the invitation* an
 * ambiguous word in a file whose whole job is to keep them apart.
 *
 * **Validates: v3 Req 38.3, 38.4**
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AddressedInvite, AddressedInviteListing } from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';

/** Where a session's own routes live */
const SESSIONS_PATH = '/api/sessions';

/** Where an invitation's own routes live */
const INVITATIONS_PATH = '/api/invitations';

/** What the DM's addressed-invite surface needs */
export interface SessionInvitationsState {
  /** Everything this table has written to, newest first — including the answered and expired */
  invites: AddressedInvite[];
  /** True while the first read is in flight */
  isPending: boolean;
  /** True while a write is on the wire, so no button can be pressed twice */
  isBusy: boolean;
  error: string | null;
  /** Write to an address; reports whether it landed, so the form clears only over a real send */
  send: (email: string) => Promise<boolean>;
  /** Take one back, leaving the shared code and every other letter alone */
  revoke: (invitationId: string) => void;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive one table's outbox
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The invitations and the two ways to change them
 */
export function useSessionInvitations(sessionId: string | null): SessionInvitationsState {
  const [invites, setInvites] = useState<AddressedInvite[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Which table the surface is actually showing
   *
   * `useSessionInvite`'s guard, for its reason: a request cannot be cancelled, so opening table A
   * and then table B in quick succession can land A's answer after B's — and here that would put
   * one table's invitees under another table's panel, which is somebody's address on the wrong page.
   */
  const showing = useRef<string | null>(sessionId);
  showing.current = sessionId;

  const load = useCallback(async (id: string) => {
    setIsPending(true);

    try {
      const listing = await apiRequest<AddressedInviteListing>(
        `${SESSIONS_PATH}/${id}/invitations`
      );

      if (showing.current !== id) return;

      setInvites(listing.invites);
      setError(null);
    } catch (cause) {
      if (showing.current === id) setError(messageOf(cause));
    } finally {
      if (showing.current === id) setIsPending(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setInvites([]);
      setError(null);
      return;
    }

    void load(sessionId);
  }, [sessionId, load]);

  /** Run a write, then re-read rather than trusting what the write said */
  const write = useCallback(
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
  );

  return {
    invites,
    isPending,
    isBusy,
    error,
    send: useCallback(
      (email: string) =>
        write((id) =>
          apiSend<AddressedInvite>(`${SESSIONS_PATH}/${id}/invitations`, 'POST', { email })
        ),
      [write]
    ),
    revoke: useCallback(
      (invitationId: string) => {
        // Addressed by the invitation's own id rather than by the table's, because the server
        // guards it through the row's session — the path names one letter and takes back one letter
        void write(() =>
          apiRequest<void>(`${INVITATIONS_PATH}/${invitationId}`, { method: 'DELETE' })
        );
      },
      [write]
    ),
  };
}
