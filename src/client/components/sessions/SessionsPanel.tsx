/**
 * The tables this Account sits at (TICKET-GAM-02)
 *
 * **Deliberately not the lobby.** TICKET-GAM-04 builds the roster — who is at a table, removing
 * somebody, leaving, transferring the DM role — and this is not that. What is here is the minimum
 * that makes GAM-02 a feature rather than an API: a DM can start a table from a ruleset they own and
 * get a code out of it, and everybody can see which games they are in. Without it the invite code
 * would exist and be unreachable.
 *
 * **The invitation is the DM's alone**, and that is the server's rule rather than this component's:
 * `GET /api/sessions/:id` carries `inviteCode` for a DM and omits it for a player, so a player who
 * expanded a row would see the panel say *nothing to show* rather than be trusted not to look.
 *
 * **Validates: v3 Req 37.1, 38.1, 38.2**
 */

import { Text } from '../ui/Text/Text';
import { PendingInvitations } from './PendingInvitations';
import { SessionList } from './SessionList';
import { StartSessionForm } from './StartSessionForm';
import { alertStyles } from './sessions.style';
import { useSessionsManager } from './useSessionsManager';

export function SessionsPanel() {
  const manager = useSessionsManager();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <div>
        <Text variant="h1" as="h1" className="mb-2">
          Your games
        </Text>
        <Text variant="body-secondary" as="p">
          A game plays by a copy of the ruleset it was started from, taken when it began — so
          retuning that ruleset afterwards leaves the table alone.
        </Text>
      </div>

      {manager.error && (
        <div role="alert" className={alertStyles}>
          <Text variant="error" as="p">
            {manager.error}
          </Text>
        </div>
      )}

      {/* **Above the games list, and above the form.** An invitation is the only thing on this
          page somebody else is waiting on an answer to, and it renders nothing at all when there
          is none — so it costs the ordinary visit no space (TICKET-GAM-03). */}
      <PendingInvitations
        invitations={manager.waiting.invitations}
        isPending={manager.waiting.isPending}
        isBusy={manager.waiting.isBusy}
        error={manager.waiting.error}
        onAccept={manager.acceptInvitation}
        onDecline={manager.declineInvitation}
      />

      <StartSessionForm rulesets={manager.rulesets} onStart={manager.start} />

      <SessionList
        sessions={manager.sessions}
        isPending={manager.isPending}
        openSessionId={manager.openSessionId}
        onToggle={manager.toggle}
        invite={manager.invite}
        invitations={manager.invitations}
        roster={manager.roster}
        onRemoveMember={manager.removeMember}
        onTransferDm={manager.transferDm}
      />
    </div>
  );
}
