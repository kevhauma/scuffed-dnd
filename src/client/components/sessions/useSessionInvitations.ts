/**
 * The addressed invitations one table has sent (TICKET-GAM-03)
 *
 * A named pair of writes over [`useSessionResource`](./useSessionResource.ts), which owns the
 * reading, the staleness guard and the busy flag. What is here is what a write means: writing to an
 * address, and taking one letter back.
 *
 * **It is a separate hook from `useSessionInvite` rather than a second concern inside it**, because
 * the two are different resources with different routes and different lifetimes: a table has exactly
 * one shared code, and an unbounded number of letters. Folding them together would make *the
 * invitation* an ambiguous word in a file whose whole job is to keep them apart.
 *
 * **Validates: v3 Req 38.3, 38.4**
 */

import { useCallback } from 'react';
import type { AddressedInvite, AddressedInviteListing } from '#shared/types/api';
import { apiRequest, apiSend } from '../../services/api';
import { SESSIONS_PATH, useSessionResource } from './useSessionResource';

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

/**
 * Drive one table's outbox
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The invitations and the two ways to change them
 */
export function useSessionInvitations(sessionId: string | null): SessionInvitationsState {
  const { data, isPending, isBusy, error, write } = useSessionResource<AddressedInviteListing>(
    sessionId,
    (id) => `${SESSIONS_PATH}/${id}/invitations`
  );

  return {
    invites: data?.invites ?? [],
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
