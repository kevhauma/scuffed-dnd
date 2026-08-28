/**
 * The code a DM hands out (TICKET-GAM-02)
 *
 * **A code *and* a link, because a table uses both.** The code is what gets read aloud when everyone
 * is in the room; the link is what gets pasted when they are not. They are the same invitation, so
 * they are shown together rather than as two features.
 *
 * **Copying is offered but never assumed.** `navigator.clipboard` needs a secure context and a
 * permission, so the code and the link are always on screen as text a User can select — the button
 * is a convenience that can fail without taking anything with it.
 *
 * **An expired code says so rather than looking live.** The server deliberately still sends one — a
 * DM shown nothing would read that as *I never issued one* — so this is where *stale* becomes
 * visible, with *New code* as the remedy beside it (the GAM-02 review).
 *
 * **An archived table cannot issue and can still revoke**, which is the server's rule rendered
 * rather than guessed: inviting somebody to a game that has ended is refused, and a DM who archived
 * first must still be able to invalidate a link they posted publicly.
 *
 * **Validates: v3 Req 37.5, 38.1, 38.2**
 */

import { useState } from 'react';
import type { SessionInvite } from '#shared/types/api';
import { readableMoment } from '../shared/readableMoment';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertStyles, inviteCodeStyles, sectionStyles } from './sessions.style';

export interface InviteCodePanelProps {
  /** The live invitation, or `null` when this table has none */
  invite: SessionInvite | null;
  /** False for an archived table, where the server refuses to issue one */
  canInvite: boolean;
  isPending: boolean;
  isBusy: boolean;
  error: string | null;
  onIssue: () => void;
  onRevoke: () => void;
}

/**
 * The link that carries a code
 *
 * Built from `window.location.origin` rather than from anything configured, for D1's reason: the
 * backend is this server, and a base URL somebody can set is a base URL somebody eventually sets
 * wrong. Rendered as text so it is right even where `navigator.clipboard` is unavailable.
 */
function joinLink(code: string): string {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

/** The invitation as it stands, with the two things a DM does to it */
function LiveCode({
  invite,
  canInvite,
  isBusy,
  onIssue,
  onRevoke,
}: Omit<InviteCodePanelProps, 'isPending' | 'error' | 'invite'> & { invite: SessionInvite }) {
  /** Which value was last copied, so the acknowledgement says *what* rather than merely *yes* */
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(label))
      .catch(() => setCopied(null));
  };

  const isExpired = invite.expiresAt <= Date.now();

  return (
    <div className="flex flex-col gap-3">
      {isExpired ? (
        <Text variant="warning" as="p">
          This code expired on {readableMoment(invite.expiresAt)} and no longer works. Make a new
          one when you want to let somebody in.
        </Text>
      ) : (
        <Text variant="body-small-secondary" as="p">
          Read this out, or send the link. Anyone signed in who has it can join as a player, until{' '}
          {readableMoment(invite.expiresAt)}.
        </Text>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className={inviteCodeStyles}>{invite.code}</span>
        <Button variant="secondary" size="sm" onClick={() => copy('Code copied.', invite.code)}>
          Copy code
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copy('Link copied.', joinLink(invite.code))}
        >
          Copy link
        </Button>
      </div>

      {/* The link stays on screen whatever has been copied — a panel that replaced it with an
          acknowledgement would take away the thing somebody without a clipboard has to read */}
      <Text variant="caption" as="p">
        {joinLink(invite.code)}
      </Text>
      {copied && (
        <output>
          <Text variant="caption" as="span">
            {copied}
          </Text>
        </output>
      )}

      <div className="flex flex-wrap gap-3">
        {canInvite && (
          <Button variant="secondary" size="sm" disabled={isBusy} onClick={onIssue}>
            New code
          </Button>
        )}
        <Button variant="danger" size="sm" disabled={isBusy} onClick={onRevoke}>
          Take it back
        </Button>
      </div>
      {canInvite && (
        <Text variant="caption" as="p">
          A new code retires this one, so anybody still holding the old link will have to ask you
          again.
        </Text>
      )}
    </div>
  );
}

/** What fills the panel, given which of the four states it is in */
function Body({
  invite,
  canInvite,
  isPending,
  isBusy,
  onIssue,
  onRevoke,
}: Omit<InviteCodePanelProps, 'error'>) {
  if (isPending) {
    return (
      <Text variant="caption" as="p">
        Checking this table…
      </Text>
    );
  }

  if (!invite) {
    return canInvite ? (
      <div className="flex flex-col items-start gap-3">
        <Text variant="body" as="p">
          This table has no invitation out. Make one when you are ready to let people in.
        </Text>
        <Button variant="primary" size="sm" disabled={isBusy} onClick={onIssue}>
          Create an invite code
        </Button>
      </div>
    ) : (
      // The server's own answer, said before the click rather than as a 409 after it
      <Text variant="body" as="p">
        This game has been archived, so nobody new can join it and no invitation can be made.
      </Text>
    );
  }

  return (
    <LiveCode
      invite={invite}
      canInvite={canInvite}
      isBusy={isBusy}
      onIssue={onIssue}
      onRevoke={onRevoke}
    />
  );
}

export function InviteCodePanel({ error, ...state }: InviteCodePanelProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Invite your table
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        <Body {...state} />
      </section>
    </Card>
  );
}
