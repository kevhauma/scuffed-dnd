/**
 * The code one table is handing out, and the two things a DM does to it (TICKET-GAM-02)
 *
 * **Issue, reissue and revoke are two routes and three verbs**, because reissuing *is* issuing —
 * `POST` revokes whatever was live and inserts a replacement in one transaction, so there is never a
 * moment with two live codes or none. The DM's surface offers them as *New code* and *Take it back*,
 * which is what those two acts are called at a table.
 *
 * **The invitation arrives with the session**, not from a route of its own: `GET /api/sessions/:id`
 * carries `invite` for a DM and omits it for everybody else. So this reads the session to find one,
 * and re-reads after a write rather than trusting what it sent.
 *
 * The reading, the staleness guard and the busy flag are
 * [`useSessionResource`](./useSessionResource.ts)'s since TICKET-GAM-04 — this was the first of the
 * three surfaces keyed on the open row, and the third is what earned them one implementation.
 *
 * **Validates: v3 Req 38.1, 38.2**
 */

import { useCallback } from 'react';
import type { GameSessionDocument, SessionInvite } from '#shared/types/api';
import { apiRequest, apiSend } from '../../services/api';
import { SESSIONS_PATH, useSessionResource } from './useSessionResource';

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

/**
 * Drive one table's invitation
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The invitation and the two ways to change it
 */
export function useSessionInvite(sessionId: string | null): SessionInviteState {
  const { data, isPending, isBusy, error, write } = useSessionResource<GameSessionDocument>(
    sessionId,
    (id) => `${SESSIONS_PATH}/${id}`
  );

  return {
    // Absent for a player and for a DM with no live code — both read as "there is nothing to show
    // you", which is the truth in each case
    invite: data?.invite ?? null,
    isPending,
    isBusy,
    error,
    issue: useCallback(() => {
      void write((id) => apiSend<SessionInvite>(`${SESSIONS_PATH}/${id}/invite`, 'POST', {}));
    }, [write]),
    revoke: useCallback(() => {
      void write((id) => apiRequest<void>(`${SESSIONS_PATH}/${id}/invite`, { method: 'DELETE' }));
    }, [write]),
  };
}
