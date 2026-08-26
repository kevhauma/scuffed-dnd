/**
 * The tables, one row each (TICKET-GAM-02)
 *
 * **Every row says what you are at it**, the way every ruleset row says which home it lives in
 * (v3 Req 36.8's discipline applied one aggregate over): *You run this* and *You play here* are
 * different situations with different affordances, and a row that left the reader to infer which
 * would be a row that leaves them to guess whether they can invite anybody.
 *
 * **Only a DM's row expands**, because the only thing behind it today is the invitation and that is
 * the DM's. GAM-04's roster is what gives a player something to open.
 *
 * **Validates: v3 Req 37.1, 38.1**
 */

import type { GameSessionSummary, MemberRole } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { InviteCodePanel } from './InviteCodePanel';
import {
  archivedBadgeStyles,
  dmBadgeStyles,
  playerBadgeStyles,
  sectionStyles,
  sessionRowStyles,
} from './sessions.style';
import type { SessionInviteState } from './useSessionInvite';

export interface SessionListProps {
  sessions: GameSessionSummary[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  /** Which row is expanded, or `null` */
  openSessionId: string | null;
  onToggle: (sessionId: string) => void;
  /** The open row's invitation */
  invite: SessionInviteState;
}

/** A moment somebody can read, in their own locale */
function startedOn(createdAt: number): string {
  return new Date(createdAt).toLocaleString();
}

/**
 * What a role is called on a row, and how it is set
 *
 * A table rather than a ternary spelled twice: the label and the tone are one decision, and writing
 * them as two conditionals is how they come to disagree about what a role is.
 */
const ROLE_BADGE: Record<MemberRole, { label: string; className: string }> = {
  [MEMBER_ROLE.DM]: { label: 'You run this', className: dmBadgeStyles },
  [MEMBER_ROLE.PLAYER]: { label: 'You play here', className: playerBadgeStyles },
};

/** One table, and the invitation behind it when it is yours and open */
function SessionRow({
  session,
  isOpen,
  onToggle,
  invite,
}: {
  session: GameSessionSummary;
  isOpen: boolean;
  onToggle: () => void;
  invite: SessionInviteState;
}) {
  const isDm = session.role === MEMBER_ROLE.DM;
  const badge = ROLE_BADGE[session.role];

  return (
    <div className="flex flex-col gap-3">
      <div className={sessionRowStyles}>
        <div className="flex flex-col">
          <span className={badge.className}>{badge.label}</span>
          <Text variant="h5" as="h3">
            {session.name}
          </Text>
          <Text variant="caption" as="span">
            Started {startedOn(session.createdAt)}
          </Text>
          {session.status === SESSION_STATUS.ARCHIVED && (
            <span className={archivedBadgeStyles}>Archived</span>
          )}
        </div>

        {isDm && (
          <Button variant="secondary" size="sm" onClick={onToggle}>
            {isOpen ? 'Hide invite' : 'Invite'}
          </Button>
        )}
      </div>

      {isDm && isOpen && (
        <InviteCodePanel
          invite={invite.invite}
          // The server refuses to issue one on an archived table (`requireActive`), so the panel
          // says so before the click rather than offering a button that always 409s
          canInvite={session.status !== SESSION_STATUS.ARCHIVED}
          isPending={invite.isPending}
          isBusy={invite.isBusy}
          error={invite.error}
          onIssue={invite.issue}
          onRevoke={invite.revoke}
        />
      )}
    </div>
  );
}

/**
 * What fills the section, given which of the two states it is in
 *
 * **There is no signed-out branch**, and the GAM-02 review is why there was one: `/sessions` is in
 * `PROTECTED_ROUTES` and composes `RequireAccount`, which renders nothing until there is an Account
 * — so a polite *sign in to see your games* here was a second design for the same case, shipped
 * beside the redirect and unreachable behind it.
 */
function Body({ sessions, isPending, openSessionId, onToggle, invite }: SessionListProps) {
  if (isPending) {
    return (
      <Text variant="caption" as="p">
        Checking your games…
      </Text>
    );
  }

  if (sessions.length === 0) {
    return (
      <Text variant="body" as="p">
        You are not in any games yet. Start one above, or follow an invitation somebody sent you.
      </Text>
    );
  }

  return (
    <>
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          isOpen={openSessionId === session.id}
          onToggle={() => onToggle(session.id)}
          invite={invite}
        />
      ))}
    </>
  );
}

export function SessionList(props: SessionListProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h3" as="h2">
          Games you are in
        </Text>

        <Body {...props} />
      </section>
    </Card>
  );
}
