/**
 * Who is at one table (TICKET-GAM-04)
 *
 * A named pair of writes over [`useSessionResource`](./useSessionResource.ts), which owns the
 * reading, the staleness guard and the busy flag for all three of the surfaces keyed on the open
 * row. What is here is what a write *means*: taking a seat away, and handing the table over.
 *
 * **Both report whether they landed**, because both change what the caller may do next — leaving
 * takes the table out of their own list, and handing it over takes their DM controls away. The
 * manager reloads the games listing over either, and only over one that happened.
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5, 39.7**
 */

import { useCallback } from 'react';
import type {
  SessionCharacterSummary,
  SessionMemberListing,
  SessionMemberSummary,
} from '#shared/types/api';
import { apiRequest, apiSend } from '../../services/api';
import { SESSIONS_PATH, useSessionResource } from './useSessionResource';

/** What the lobby needs */
export interface SessionMembersState {
  members: SessionMemberSummary[];
  /** Characters whose owner has left — kept at the table, writable by nobody (v3 Req 39.3) */
  departedCharacters: SessionCharacterSummary[];
  /** True while the first read is in flight */
  isPending: boolean;
  /** True while a write is on the wire, so no button can be pressed twice */
  isBusy: boolean;
  error: string | null;
  /**
   * Read the roster again, with nothing written first (TICKET-LIVE-04)
   *
   * `useSessionResource`'s own `reload`, handed out for the one membership Event the roster's feed
   * cannot apply: a join names an Account by id and carries no name, and a member list is a list of
   * names. Every other membership Event is patched in place and costs nothing.
   */
  reload: () => Promise<void>;
  /** Take a seat away — the DM removing somebody, or anybody giving up their own */
  remove: (accountId: string) => Promise<boolean>;
  /** Hand the table to another Member; the caller stays at it as a player */
  transfer: (accountId: string) => Promise<boolean>;
}

/**
 * Drive one table's roster
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The roster and the two ways to change it
 */
export function useSessionMembers(sessionId: string | null): SessionMembersState {
  const { data, isPending, isBusy, error, reload, write } =
    useSessionResource<SessionMemberListing>(sessionId, (id) => `${SESSIONS_PATH}/${id}/members`);

  return {
    members: data?.members ?? [],
    departedCharacters: data?.departedCharacters ?? [],
    isPending,
    isBusy,
    error,
    reload,
    remove: useCallback(
      (accountId: string) =>
        write((id) =>
          apiRequest<void>(`${SESSIONS_PATH}/${id}/members/${accountId}`, { method: 'DELETE' })
        ),
      [write]
    ),
    transfer: useCallback(
      (accountId: string) =>
        write((id) => apiSend(`${SESSIONS_PATH}/${id}/dm`, 'POST', { accountId })),
      [write]
    ),
  };
}
