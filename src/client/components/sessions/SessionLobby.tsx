/**
 * Who is at this table (TICKET-GAM-04)
 *
 * **The first surface in the app that shows other people**, which is what makes it worth building
 * as the session's *one* member list rather than as a page TICKET-DM-04 will need a sibling for.
 * That ticket grows this into the DM's roster with quick actions; it does not replace it.
 *
 * **Connection says *Unknown*, and that is a claim about what we can observe rather than a
 * placeholder.** The app cannot tell a player who closed the tab from one sitting quietly until
 * LIVE-01's socket exists, so it says so. Writing *Offline* would be the same mistake as showing a
 * confident zero for a formula that could not be evaluated — the discipline this codebase applies
 * to a chipped stat, applied to a person.
 *
 * **What each Member may do to whom is the server's rule, drawn rather than guessed**: the DM may
 * take anybody else's seat and hand the game over; everybody may give up their own; and the DM's own
 * row offers neither, because a table with no DM has nobody who can invite, archive or transfer
 * (v3 Req 39.6).
 *
 * **All three actions confirm**, through `ui/Dialog` like every other confirm in the app
 * (`DeleteRulesetConfirmation` is the exemplar). Each is hard to undo from here: a player who leaves
 * needs a fresh invitation, a removed player likewise, and a DM who hands the game over cannot hand
 * it back. What none of them destroys is a Character — the sentence says so, because *removed* reads
 * like *deleted* and here it is not.
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5, 39.6, 39.7**
 */

import { useState } from 'react';
import type { MemberRole, SessionCharacterSummary, SessionMemberSummary } from '#shared/types/api';
import { MEMBER_ROLE } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Dialog } from '../ui/Dialog/Dialog';
import { Text } from '../ui/Text/Text';
import { readableMoment } from './sessionMoment';
import {
  alertStyles,
  dmBadgeStyles,
  playerBadgeStyles,
  sectionStyles,
  sessionRowStyles,
  unknownBadgeStyles,
} from './sessions.style';

export interface SessionLobbyProps {
  members: SessionMemberSummary[];
  /** Characters whose owner has left — kept at the table, writable by nobody */
  departedCharacters: SessionCharacterSummary[];
  /** Which Account is reading this, so its own row can be told apart */
  accountId: string | null;
  /** True when the reader runs this table */
  isDm: boolean;
  /** False for an archived table, where the server refuses to hand the game over */
  canTransfer: boolean;
  isPending: boolean;
  isBusy: boolean;
  error: string | null;
  onRemove: (accountId: string) => void;
  onTransfer: (accountId: string) => void;
}

/** What a role is called on a row, matching the badges the games list uses */
const ROLE_BADGE: Record<MemberRole, { label: string; className: string }> = {
  [MEMBER_ROLE.DM]: { label: 'Runs this game', className: dmBadgeStyles },
  [MEMBER_ROLE.PLAYER]: { label: 'Player', className: playerBadgeStyles },
};

/** The three things a row can ask for, each of which is worth a question first */
const LOBBY_ACTION = {
  LEAVE: 'leave',
  REMOVE: 'remove',
  TRANSFER: 'transfer',
} as const;

type LobbyAction = (typeof LOBBY_ACTION)[keyof typeof LOBBY_ACTION];

/** What is waiting on an answer */
interface PendingAction {
  action: LobbyAction;
  member: SessionMemberSummary;
}

/**
 * The question each action asks, and what the button that does it is called
 *
 * A table rather than three conditionals, for `ROLE_BADGE`'s reason: the wording and the verb are
 * one decision per action, and the *nothing is deleted* clause has to appear in two of them —
 * which is exactly the sort of thing that goes missing from one when they are written apart.
 */
const CONFIRMATION: Record<
  LobbyAction,
  { title: string; body: (name: string) => string; verb: string }
> = {
  [LOBBY_ACTION.LEAVE]: {
    title: 'Leave this game?',
    body: () =>
      'Your characters stay at the table for the others to read, and you will need a new ' +
      'invitation to come back. Nothing is deleted.',
    verb: 'Leave',
  },
  [LOBBY_ACTION.REMOVE]: {
    title: 'Remove this player?',
    body: (name) =>
      `${name} loses access to this game. Their characters stay at the table — everybody can ` +
      'read them and nobody can change them, including you. Nothing is deleted.',
    verb: 'Remove them',
  },
  [LOBBY_ACTION.TRANSFER]: {
    title: 'Hand this game over?',
    body: (name) =>
      `${name} becomes the one who runs it, and you become a player at your own table. Only ` +
      'they can hand it back.',
    verb: 'Hand it over',
  },
};

/** The characters somebody is playing, or a note that they are playing none */
function Characters({ characters }: { characters: SessionCharacterSummary[] }) {
  return (
    <Text variant="caption" as="span">
      {characters.length === 0 ? 'No character yet' : characters.map((one) => one.name).join(', ')}
    </Text>
  );
}

/** One Member, and whatever the reader may do about them */
function MemberRow({
  member,
  isYou,
  isDm,
  canTransfer,
  isBusy,
  onAsk,
}: {
  member: SessionMemberSummary;
  isYou: boolean;
  onAsk: (pending: PendingAction) => void;
} & Pick<SessionLobbyProps, 'isDm' | 'canTransfer' | 'isBusy'>) {
  const badge = ROLE_BADGE[member.role];
  const isTheDm = member.role === MEMBER_ROLE.DM;

  return (
    <div className={sessionRowStyles}>
      <div className="flex flex-col">
        <span className={badge.className}>{badge.label}</span>
        <Text variant="body" as="span">
          {member.name}
          {isYou && ' (you)'}
        </Text>
        <Characters characters={member.characters} />
        <Text variant="caption" as="span">
          Joined {readableMoment(member.joinedAt)}
        </Text>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* The column LIVE-03 fills in. Until then it says what is true: we cannot tell. */}
        <span className={unknownBadgeStyles}>Connection unknown</span>

        {/* The DM's own row offers nothing — leaving is refused until the game is handed over */}
        {isYou && !isTheDm && (
          <Button
            variant="danger"
            size="sm"
            disabled={isBusy}
            onClick={() => onAsk({ action: LOBBY_ACTION.LEAVE, member })}
          >
            Leave
          </Button>
        )}
        {isDm && !isYou && (
          <>
            {canTransfer && (
              <Button
                variant="secondary"
                size="sm"
                disabled={isBusy}
                onClick={() => onAsk({ action: LOBBY_ACTION.TRANSFER, member })}
              >
                Hand over
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              disabled={isBusy}
              onClick={() => onAsk({ action: LOBBY_ACTION.REMOVE, member })}
            >
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** The characters nobody at the table owns any more (v3 Req 39.3) */
function Departed({ characters }: { characters: SessionCharacterSummary[] }) {
  if (characters.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Text variant="body-small-secondary" as="p">
        Still at the table, but their player has gone. Everybody can read them; nobody can change
        them.
      </Text>
      <Text variant="caption" as="p">
        {characters.map((one) => one.name).join(', ')}
      </Text>
    </div>
  );
}

export function SessionLobby({
  members,
  departedCharacters,
  accountId,
  isDm,
  canTransfer,
  isPending,
  isBusy,
  error,
  onRemove,
  onTransfer,
}: SessionLobbyProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);

  const confirm = () => {
    if (!pending) return;

    if (pending.action === LOBBY_ACTION.TRANSFER) onTransfer(pending.member.accountId);
    else onRemove(pending.member.accountId);

    setPending(null);
  };

  const question = pending ? CONFIRMATION[pending.action] : null;

  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Who is at this table
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        {isPending ? (
          <Text variant="caption" as="p">
            Checking who is here…
          </Text>
        ) : (
          members.map((member) => (
            <MemberRow
              key={member.accountId}
              member={member}
              isYou={member.accountId === accountId}
              isDm={isDm}
              canTransfer={canTransfer}
              isBusy={isBusy}
              onAsk={setPending}
            />
          ))
        )}

        <Departed characters={departedCharacters} />
      </section>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={question?.title ?? ''}
      >
        <div className="flex flex-col gap-4">
          <Text variant="body" as="p">
            {pending && question ? question.body(pending.member.name) : ''}
          </Text>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm}>
              {question?.verb ?? ''}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
