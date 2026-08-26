/**
 * The sessions surface's decisions, in one place (TICKET-GAM-02)
 *
 * `useRulesetManager`'s counterpart: it composes rather than does. The listing and the create are
 * [`useSessions`](./useSessions.ts), the DM's code is
 * [`useSessionInvite`](./useSessionInvite.ts), and the rulesets to start a table *from* come from
 * `useAccountRulesets` — reused rather than re-fetched, because *which rulesets does this Account
 * own* is a question with one answer and one hook already asking it.
 *
 * **One table is open at a time**, and that is what the invite hook is keyed on: opening a row is
 * what fetches its code, so a list of ten tables is one request rather than ten.
 *
 * **Everything here assumes an Account**, because `/sessions` is protected and `RequireAccount`
 * renders nothing without one. That is why there is no `isSignedIn` in what this returns — the GAM-02
 * review found it threaded through three components to feed branches the redirect makes unreachable.
 *
 * **Validates: v3 Req 37.1, 38.1, 38.2**
 */

import { useCallback, useState } from 'react';
import type { GameSessionSummary, RulesetSummary } from '#shared/types/api';
import { useAccountRulesets } from '../rulesets/useAccountRulesets';
import { type InvitationsState, useInvitations } from './useInvitations';
import { type SessionInvitationsState, useSessionInvitations } from './useSessionInvitations';
import type { SessionInviteState } from './useSessionInvite';
import { useSessionInvite } from './useSessionInvite';
import { useSessions } from './useSessions';

/** What the sessions surface needs */
export interface SessionsManager {
  /** True while either answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  sessions: GameSessionSummary[];
  /** The Account's rulesets, so a table can be started from one */
  rulesets: RulesetSummary[];
  error: string | null;

  /** Which table's details are open, or `null` */
  openSessionId: string | null;
  toggle: (sessionId: string) => void;
  /** The open table's invitation, inert while none is open */
  invite: SessionInviteState;
  /** The open table's addressed invitations, likewise (TICKET-GAM-03) */
  invitations: SessionInvitationsState;

  /** What is waiting for **this Account**, whoever's table sent it (TICKET-GAM-03) */
  waiting: InvitationsState;
  /** Take one up, which seats this Account and puts a new game in the list above */
  acceptInvitation: (invitationId: string) => void;
  /** Turn one down — a recorded outcome the DM sees, not a dismissal */
  declineInvitation: (invitationId: string) => void;

  /** Start a table. Reports whether it landed, so a form only clears over a change that happened. */
  start: (rulesetId: string, name: string) => Promise<boolean>;
}

export function useSessionsManager(): SessionsManager {
  const sessions = useSessions();
  // `useAccountRulesets` keeps its `enabled` parameter — it has another caller, on `/rulesets`,
  // which is deliberately *not* protected and really does render signed out
  const rulesets = useAccountRulesets(true);

  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const invite = useSessionInvite(openSessionId);
  const invitations = useSessionInvitations(openSessionId);
  const waiting = useInvitations();

  const reloadSessions = sessions.reload;
  const acceptWaiting = waiting.accept;
  const declineWaiting = waiting.decline;

  return {
    isPending: sessions.isPending,
    sessions: sessions.sessions,
    rulesets: rulesets.rulesets,
    // The listing's own refusal, and the rulesets' — shown independently of the invite panel's,
    // which renders inside the row it belongs to (the IO-04 review's lesson about masked errors)
    error: sessions.error ?? rulesets.error,

    openSessionId,
    toggle: useCallback(
      (sessionId: string) => setOpenSessionId((open) => (open === sessionId ? null : sessionId)),
      []
    ),
    invite,
    invitations,

    waiting,
    acceptInvitation: useCallback(
      (invitationId: string) => {
        // Accepting seats this Account at a table it was not at a moment ago, so the games list
        // above is now out of date — reloaded only over an acceptance that landed, which is why
        // `accept` reports rather than assumes
        void acceptWaiting(invitationId).then((joined) => {
          if (joined) reloadSessions();
        });
      },
      [acceptWaiting, reloadSessions]
    ),
    // No reload: declining changes nothing about which games this Account is in. Here beside
    // `acceptInvitation` all the same, so the panel reaches one level into the manager for both
    // rather than through it for one of them
    declineInvitation: useCallback(
      (invitationId: string) => void declineWaiting(invitationId),
      [declineWaiting]
    ),

    start: useCallback(
      (rulesetId: string, name: string) => sessions.create({ rulesetId, name }),
      [sessions.create]
    ),
  };
}
