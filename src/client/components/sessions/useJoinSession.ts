/**
 * Following an invite link (TICKET-GAM-02)
 *
 * **Two steps, and the first one is the point.** The to-be asks that following a link while signed
 * in *shows what is being joined before joining* — so this previews first and seats nobody until the
 * User says so. A link that silently added you to a stranger's game would be a link nobody could
 * safely click.
 *
 * **Signed out is not this hook's problem.** The route is protected, so `RequireAccount` takes the
 * visitor to sign-in carrying where to come back to and returns them here afterwards (v3 Req 32.7) —
 * AUTH-03's behaviour reused rather than a second implementation.
 *
 * **Already a member is a success.** The server answers `joined: false` with the membership the
 * Account already had, and this reports it as *you are already at this table* rather than as an
 * error, because somebody will click the link twice.
 *
 * **Validates: v3 Req 38.1, 38.4, 38.7**
 */

import { useCallback, useEffect, useState } from 'react';
import type { GameSessionSummary, InvitePreview, InviteRedemption } from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';

/** Where an invitation's routes live */
const INVITES_PATH = '/api/invites';

/** How a join attempt ended */
export const JOIN_OUTCOME = {
  /** A seat was taken by this click */
  JOINED: 'joined',
  /** The Account was already at the table — a success, and said so (v3 Req 38.7) */
  ALREADY: 'already',
} as const;

export type JoinOutcome = (typeof JOIN_OUTCOME)[keyof typeof JOIN_OUTCOME];

/** What the join surface needs */
export interface JoinSessionState {
  /** What the code opens, once the preview has come back */
  preview: InvitePreview | null;
  /** True while the preview is in flight — neither an invitation nor a refusal yet */
  isPending: boolean;
  /** True while the join is on the wire */
  isBusy: boolean;
  /**
   * Why the code cannot be used, in the server's own words
   *
   * v3 Req 38.4 asks for a distinct message for each of expired, revoked, unknown and archived, and
   * the server writes all four — so this renders what it was told rather than deciding for itself.
   */
  error: string | null;
  /** How it ended, once it has */
  outcome: JoinOutcome | null;
  /** The table, once a seat is taken */
  session: GameSessionSummary | null;
  join: () => void;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive one invitation
 *
 * **No `enabled` flag**, because the route composes `RequireAccount` and splits the component so
 * that this is never called without an Account — the GAM-02 review pointed out that the parameter's
 * documented purpose ("false while `useAuth` is still deciding") was made unreachable by exactly
 * that split. The guarantee is the route's shape rather than a boolean the caller has to remember.
 *
 * @param code The code from the link, exactly as it appeared in the path
 * @returns The preview, the outcome, and the one action
 */
export function useJoinSession(code: string): JoinSessionState {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<JoinOutcome | null>(null);
  const [session, setSession] = useState<GameSessionSummary | null>(null);

  useEffect(() => {
    let current = true;
    setIsPending(true);

    void apiRequest<InvitePreview>(`${INVITES_PATH}/${encodeURIComponent(code)}`)
      .then((answer) => {
        // The request cannot be cancelled, so the answer to a code the User has navigated away from
        // must not land on the surface showing a different one
        if (current) setPreview(answer);
      })
      .catch((cause: unknown) => {
        if (current) setError(messageOf(cause));
      })
      .finally(() => {
        if (current) setIsPending(false);
      });

    return () => {
      current = false;
    };
  }, [code]);

  return {
    preview,
    isPending,
    isBusy,
    error,
    outcome,
    session,
    join: useCallback(() => {
      if (isBusy) return;

      setIsBusy(true);
      setError(null);

      void apiSend<InviteRedemption>(`${INVITES_PATH}/${encodeURIComponent(code)}`, 'POST', {})
        .then((redeemed) => {
          setSession(redeemed.session);
          setOutcome(redeemed.joined ? JOIN_OUTCOME.JOINED : JOIN_OUTCOME.ALREADY);
        })
        .catch((cause: unknown) => setError(messageOf(cause)))
        .finally(() => setIsBusy(false));
    }, [code, isBusy]),
  };
}
