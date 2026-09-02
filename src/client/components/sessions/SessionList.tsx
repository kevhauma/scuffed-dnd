/**
 * The tables, one row each (TICKET-GAM-02)
 *
 * **Every row says what you are at it**, the way every ruleset row says which home it lives in
 * (v3 Req 36.8's discipline applied one aggregate over): *You run this* and *You play here* are
 * different situations with different affordances, and a row that left the reader to infer which
 * would be a row that leaves them to guess whether they can invite anybody.
 *
 * **Every row expands, since TICKET-GAM-04.** It used to be the DM's alone, because the only thing
 * behind one was the invitation — and that is still the DM's. What everybody now gets is the lobby:
 * a table is other people, and a player who could not see who else was at theirs would be playing
 * alone with extra steps. So the button is *Who is here* rather than *Invite*, and the invitation
 * panels sit under it for the one Member they belong to.
 *
 * **Validates: v3 Req 37.1, 38.1, 39.7**
 */

import type { GameSessionSummary, MemberRole } from '#shared/types/api';
import { MEMBER_ROLE, SESSION_STATUS } from '#shared/types/api';
import { readableMoment } from '../shared/readableMoment';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { AddressedInvitePanel } from './AddressedInvitePanel';
import { InviteCodePanel } from './InviteCodePanel';
import { RosterRollLog } from './roster/RosterRollLog';
import { SessionRoster } from './roster/SessionRoster';
import type { SessionRosterState } from './roster/useSessionRoster';
import {
  archivedBadgeStyles,
  dmBadgeStyles,
  playerBadgeStyles,
  sectionStyles,
  sessionRowStyles,
} from './sessions.style';
import type { SessionInvitationsState } from './useSessionInvitations';
import type { SessionInviteState } from './useSessionInvite';

export interface SessionListProps {
  sessions: GameSessionSummary[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  /** Which row is expanded, or `null` */
  openSessionId: string | null;
  onToggle: (sessionId: string) => void;
  /** The open row's shared code */
  invite: SessionInviteState;
  /** The open row's addressed invitations (TICKET-GAM-03) */
  invitations: SessionInvitationsState;
  /**
   * The open row's roster (TICKET-DM-04) — without its writes, which arrive wrapped below
   *
   * One prop where GAM-04's `members` and CHAR-04's `characters` were two, because the surface
   * beneath is one list rather than two panels (v3 Req 49.8).
   */
  roster: Omit<SessionRosterState, 'remove' | 'transfer'>;
  onRemoveMember: (accountId: string) => void;
  onTransferDm: (accountId: string) => void;
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

/** One table: who is at it, and — for its DM — the two ways to invite somebody else */
function SessionRow({
  session,
  isOpen,
  onToggle,
  invite,
  invitations,
  roster,
  onRemoveMember,
  onTransferDm,
}: {
  session: GameSessionSummary;
  isOpen: boolean;
  onToggle: () => void;
} & Pick<
  SessionListProps,
  'invite' | 'invitations' | 'roster' | 'onRemoveMember' | 'onTransferDm'
>) {
  const isDm = session.role === MEMBER_ROLE.DM;
  const badge = ROLE_BADGE[session.role];
  // **Named for what it is rather than for its first caller.** `requireActive` refuses every write
  // on an archived table — both invitations, the DM transfer, and creating a character — so each
  // panel says so before the click rather than offering a button that always 409s. It was
  // `canInvite` until CHAR-04 gave it a third meaning it did not read as.
  const isActive = session.status !== SESSION_STATUS.ARCHIVED;

  return (
    <div className="flex flex-col gap-3">
      <div className={sessionRowStyles}>
        <div className="flex flex-col">
          <span className={badge.className}>{badge.label}</span>
          <Text variant="h5" as="h3">
            {session.name}
          </Text>
          <Text variant="caption" as="span">
            Started {readableMoment(session.createdAt)}
          </Text>
          {session.status === SESSION_STATUS.ARCHIVED && (
            <span className={archivedBadgeStyles}>Archived</span>
          )}
        </div>

        {/* Every row, since GAM-04 — a player has a lobby to open even though the invitations
            behind it are not theirs */}
        <Button variant="secondary" size="sm" onClick={onToggle}>
          {isOpen ? 'Hide' : 'Who is here'}
        </Button>
      </div>

      {isOpen && (
        <>
          {/* One list where GAM-04's lobby and CHAR-04's character panel were two (v3 Req 49.8) */}
          <SessionRoster
            sessionId={session.id}
            roster={roster}
            // The server refuses to hand an archived game over, and to create a character in one
            // (`requireActive`), so both are absent rather than offered and always 409ing
            canTransfer={isActive}
            canCreate={isActive}
            onRemove={onRemoveMember}
            onTransfer={onTransferDm}
          />

          {/* Below the roster and above the invitations: *who is here* is what a table is, *what
              they have been throwing* is what they are doing, and the invitations are for people
              who are not here yet */}
          <RosterRollLog rolls={roster.rolls} isPending={roster.areRollsPending} />

          {isDm && (
            <>
              <InviteCodePanel
                invite={invite.invite}
                canInvite={isActive}
                isPending={invite.isPending}
                isBusy={invite.isBusy}
                error={invite.error}
                onIssue={invite.issue}
                onRevoke={invite.revoke}
              />
              <AddressedInvitePanel
                invites={invitations.invites}
                canInvite={isActive}
                isPending={invitations.isPending}
                isBusy={invitations.isBusy}
                error={invitations.error}
                onInvite={invitations.send}
                onRevoke={invitations.revoke}
              />
            </>
          )}
        </>
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
function Body({ sessions, isPending, openSessionId, onToggle, ...row }: SessionListProps) {
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
          // The rest is *the open row's* state — every row is handed it and only the open one
          // reads it, which is what keeps the whole surface one request per table rather than one
          // per row (`useSessionsManager` keys all three hooks on `openSessionId`)
          {...row}
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
