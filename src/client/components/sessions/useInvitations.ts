/**
 * What is waiting for this Account (TICKET-GAM-03)
 *
 * **The first thing the client fetches that is scoped to an Account rather than to a ruleset or a
 * session.** Everything before it hung off something the User had opened; this hangs off *them*, and
 * the ticket's note asks that it stay that way — keyed by account so that a second kind of pending
 * item can join it later without a rewrite.
 *
 * **Refetched on focus, and that is the whole of the delivery mechanism** (D12). Nothing is pushed:
 * LIVE-01's rooms are per session and an invitee is by definition not in one yet, so the way an
 * invitation *arrives* is that the tab comes back to the front and asks. A cross-account channel is
 * a bigger idea than this ticket and would be its own decision.
 *
 * **Every write reports whether it landed**, so a surface only closes over a change that happened —
 * `useSessions`'s rule, and the reason accepting can reload the games list without guessing.
 *
 * **Validates: v3 Req 38.5, 38.6, 38.7**
 */

import { useCallback, useEffect, useState } from 'react';
import type { PendingInvitation, PendingInvitationListing } from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';

/** Where an Account's own invitations live — a relative path, because there is one origin (D1) */
const INVITATIONS_PATH = '/api/invitations';

/** What the invitations surface needs */
export interface InvitationsState {
  invitations: PendingInvitation[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  /** True while an answer is on the wire, so a card cannot be answered twice */
  isBusy: boolean;
  error: string | null;
  /** Join the table this invitation names; reports whether it landed */
  accept: (invitationId: string) => Promise<boolean>;
  /** Turn it down — a recorded outcome the DM sees, not a dismissal */
  decline: (invitationId: string) => Promise<boolean>;
  /** Read the list again, for a write made somewhere else */
  reload: () => void;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive the pending-invitations list
 *
 * @returns The list and the two ways to answer one
 */
export function useInvitations(): InvitationsState {
  const [invitations, setInvitations] = useState<PendingInvitation[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvitations((await apiRequest<PendingInvitationListing>(INVITATIONS_PATH)).invitations);
      // Cleared on success, so a refusal that has stopped being true stops being shown
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
      setInvitations([]);
    }
  }, []);

  useEffect(() => {
    void load();

    // **On focus, because nothing is pushed.** An invitation sent while this tab sat in the
    // background is delivered by the act of coming back to it, which is what makes "it just shows
    // up for them" true without a channel this milestone does not have.
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);

    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  /** Answer one, then re-read rather than trusting what the answer said */
  const answer = useCallback(
    async (invitationId: string, action: string) => {
      if (isBusy) return false;

      setIsBusy(true);
      setError(null);

      try {
        await apiSend(`${INVITATIONS_PATH}/${invitationId}/${action}`, 'POST', {});
        await load();
        return true;
      } catch (cause) {
        // Re-read even on a refusal: *somebody took that back* and *you already accepted* are both
        // reasons the card should now be gone, and leaving it there invites a second click.
        // **Before the message is set**, because a successful read clears the error — putting these
        // the other way round showed the refusal for a frame and then swallowed it.
        await load();
        setError(messageOf(cause));
        return false;
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, load]
  );

  return {
    invitations: invitations ?? [],
    isPending: invitations === null,
    isBusy,
    error,
    reload: useCallback(() => void load(), [load]),
    accept: useCallback((invitationId: string) => answer(invitationId, 'accept'), [answer]),
    decline: useCallback((invitationId: string) => answer(invitationId, 'decline'), [answer]),
  };
}
