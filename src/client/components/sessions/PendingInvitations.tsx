/**
 * The invitations waiting for you (TICKET-GAM-03)
 *
 * **This is the delivery mechanism.** Nothing was emailed, nothing was pasted into a chat and there
 * is no link to click ([D12](../../../../docs/v3.0_backend/overview.md#d12--no-outbound-email-at-all)):
 * somebody typed an address, and this is where the Account holding it finds out. That is why the
 * card renders nothing at all when the list is empty — it is a notification area, and a permanent
 * *no invitations* panel is noise on every visit for the sake of a state nobody is waiting for.
 *
 * **Accept and decline are drawn as equals**, not as a primary action with an escape hatch. Turning
 * an invitation down is a normal answer and a *recorded* one — the DM sees `declined` rather than
 * silence — so a surface that hid it behind a link would be pushing people into games they did not
 * want to join.
 *
 * **Who invited you is on the card**, which v3 Req 38.7 asks for and which is the thing that makes
 * an invitation safe to accept: the table's name alone does not say whether you know anybody at it.
 *
 * **Validates: v3 Req 38.5, 38.7**
 */

import type { PendingInvitation } from '#shared/types/api';
import { readableMoment } from '../shared/readableMoment';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertStyles, sectionStyles, sessionRowStyles } from './sessions.style';

export interface PendingInvitationsProps {
  invitations: PendingInvitation[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  /** True while an answer is on the wire */
  isBusy: boolean;
  error: string | null;
  onAccept: (invitationId: string) => void;
  onDecline: (invitationId: string) => void;
}

/** One invitation, and the two answers to it */
function InvitationRow({
  invitation,
  isBusy,
  onAccept,
  onDecline,
}: {
  invitation: PendingInvitation;
} & Pick<PendingInvitationsProps, 'isBusy' | 'onAccept' | 'onDecline'>) {
  return (
    <div className={sessionRowStyles}>
      <div className="flex flex-col">
        <Text variant="h5" as="h3">
          {invitation.sessionName}
        </Text>
        <Text variant="caption" as="span">
          Invited by {invitation.invitedBy} — expires {readableMoment(invitation.expiresAt)}
        </Text>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          size="sm"
          disabled={isBusy}
          onClick={() => onAccept(invitation.id)}
        >
          Join
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isBusy}
          onClick={() => onDecline(invitation.id)}
        >
          No thanks
        </Button>
      </div>
    </div>
  );
}

export function PendingInvitations({
  invitations,
  isPending,
  isBusy,
  error,
  onAccept,
  onDecline,
}: PendingInvitationsProps) {
  // Nothing waiting and nothing to say about it — the card is a notification area rather than a
  // section of the page, so it is absent rather than empty
  if (isPending || (invitations.length === 0 && !error)) return null;

  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h3" as="h2">
          Waiting for you
        </Text>
        <Text variant="body-small-secondary" as="p">
          Somebody invited the address you signed up with. Joining puts you at their table as a
          player.
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        {invitations.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            isBusy={isBusy}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        ))}
      </section>
    </Card>
  );
}
