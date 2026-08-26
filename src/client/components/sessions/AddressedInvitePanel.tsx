/**
 * Inviting somebody by address, and what came of it (TICKET-GAM-03)
 *
 * **Beside the code panel rather than instead of it**, because a table really uses both: the code is
 * what gets read aloud in the room, and this is for the friend who is not in it. The lead says *no
 * email is sent* in words, because a DM who thought one was would wonder why nobody replied — and
 * because on-platform delivery is better than mail rather than a substitute for it, which is worth
 * saying to the person choosing.
 *
 * **The five states are shown, not filtered.** *They declined* is the single most useful thing on
 * this list, and a panel that showed only what was pending would make it indistinguishable from
 * never having invited them (v3 Req 38.4).
 *
 * **Only a pending invitation can be taken back**, which is the server's rule drawn rather than
 * guessed: a declined row deliberately keeps saying *declined* instead of being restamped, so
 * offering the button there would be offering to change nothing.
 *
 * **Validates: v3 Req 38.3, 38.4**
 */

import { useId, useState } from 'react';
import type { AddressedInvite, InviteState } from '#shared/types/api';
import { INVITE_STATE } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { FormField } from '../ui/FormField/FormField';
import { Text } from '../ui/Text/Text';
import { readableMoment } from './sessionMoment';
import { alertStyles, badgeStyles, sectionStyles, sessionRowStyles } from './sessions.style';

export interface AddressedInvitePanelProps {
  invites: AddressedInvite[];
  /** False for an archived table, where the server refuses to invite anybody new */
  canInvite: boolean;
  isPending: boolean;
  isBusy: boolean;
  error: string | null;
  /** Reports whether it landed, so the box clears only over an invitation that exists */
  onInvite: (email: string) => Promise<boolean>;
  onRevoke: (invitationId: string) => void;
}

/**
 * What each state is called, and how it is set
 *
 * A table rather than a ternary chain, for `SessionList`'s `ROLE_BADGE` reason: the word and the
 * tone are one decision, and writing them as two conditionals is how they come to disagree.
 * *Declined* is `crimson` and *expired* is `stone` deliberately — one is an answer and the other is
 * an absence of one, and a DM reads them differently.
 */
const STATE_BADGE: Record<InviteState, { label: string; className: string }> = {
  [INVITE_STATE.PENDING]: { label: 'Waiting', className: `${badgeStyles} text-royal` },
  [INVITE_STATE.ACCEPTED]: { label: 'Joined', className: `${badgeStyles} text-forest` },
  [INVITE_STATE.DECLINED]: { label: 'Declined', className: `${badgeStyles} text-crimson` },
  [INVITE_STATE.EXPIRED]: { label: 'Expired', className: `${badgeStyles} text-stone-400` },
  [INVITE_STATE.REVOKED]: { label: 'Taken back', className: `${badgeStyles} text-stone-400` },
};

/** The box a DM types an address into */
function InviteForm({ isBusy, onInvite }: Pick<AddressedInvitePanelProps, 'isBusy' | 'onInvite'>) {
  const fieldId = useId();
  const [email, setEmail] = useState('');

  const canSend = email.trim() !== '' && !isBusy;

  const send = () => {
    if (!canSend) return;

    void onInvite(email.trim()).then((sent) => {
      // Cleared only over an invitation that exists — a box that emptied itself on a refusal would
      // throw away what the DM typed along with the reason it was refused
      if (sent) setEmail('');
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField
        label="Their email address"
        id={fieldId}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="grow"
      />
      <Button variant="primary" disabled={!canSend} onClick={send}>
        {isBusy ? 'Inviting…' : 'Invite'}
      </Button>
    </div>
  );
}

/** One address and what became of it */
function InviteRow({
  invite,
  isBusy,
  onRevoke,
}: { invite: AddressedInvite } & Pick<AddressedInvitePanelProps, 'isBusy' | 'onRevoke'>) {
  const badge = STATE_BADGE[invite.state];

  const isPending = invite.state === INVITE_STATE.PENDING;

  return (
    <div className={sessionRowStyles}>
      <div className="flex flex-col">
        <span className={badge.className}>{badge.label}</span>
        <Text variant="body" as="span">
          {invite.email}
        </Text>
        {/* Only while it is waiting: on a settled row the expiry is a date nothing turns on, and
         *Declined — expires Friday* reads as though it might still be answered */}
        {isPending && (
          <Text variant="caption" as="span">
            Expires {readableMoment(invite.expiresAt)}
          </Text>
        )}
      </div>

      {isPending && (
        <Button variant="danger" size="sm" disabled={isBusy} onClick={() => onRevoke(invite.id)}>
          Take it back
        </Button>
      )}
    </div>
  );
}

/** What fills the panel below the form, given which of the three states it is in */
function Body({
  invites,
  isPending,
  isBusy,
  onRevoke,
}: Pick<AddressedInvitePanelProps, 'invites' | 'isPending' | 'isBusy' | 'onRevoke'>) {
  if (isPending) {
    return (
      <Text variant="caption" as="p">
        Checking who you have invited…
      </Text>
    );
  }

  if (invites.length === 0) {
    return (
      <Text variant="body-small-secondary" as="p">
        You have not invited anybody by address yet.
      </Text>
    );
  }

  return (
    <>
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} isBusy={isBusy} onRevoke={onRevoke} />
      ))}
    </>
  );
}

export function AddressedInvitePanel({
  invites,
  canInvite,
  isPending,
  isBusy,
  error,
  onInvite,
  onRevoke,
}: AddressedInvitePanelProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Invite somebody by email
        </Text>
        <Text variant="body-small-secondary" as="p">
          No email is sent. Whoever signed up with that address sees the invitation in their own
          games list and can accept or turn it down — and if nobody has registered it yet, it waits
          until somebody does.
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        {canInvite ? (
          <InviteForm isBusy={isBusy} onInvite={onInvite} />
        ) : (
          // The server's own answer, said before the click rather than as a 409 after it
          <Text variant="body" as="p">
            This game has been archived, so nobody new can be invited to it.
          </Text>
        )}

        <Body invites={invites} isPending={isPending} isBusy={isBusy} onRevoke={onRevoke} />
      </section>
    </Card>
  );
}
