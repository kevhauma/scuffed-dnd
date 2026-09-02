/**
 * The DM's cockpit: who is at this table, where they stand, and what to do about it
 * (TICKET-DM-04, v3 Req 49.7–49.10)
 *
 * *A round of combat is a column of presses rather than five page visits.* One row per Character with
 * its owner, level, unspent points and every resource's current-versus-maximum, and DM-03's quick
 * actions beside each one.
 *
 * ## One list, and it replaced two
 *
 * TICKET-GAM-04's `SessionLobby` answered *who is here* and TICKET-CHAR-04's `SessionCharacters`
 * answered *what is on the table*, and **both are gone**. v3 Req 49.8's criterion asks for exactly one
 * member list in the application, and the reason is the failure mode rather than tidiness: two lists
 * over one table disagree — about who is present, about whose character is whose — and a DM acting on
 * the wrong one has no way to notice. The characters are grouped under their owner, which is how one
 * list answers both questions without either being a subsection of the other.
 *
 * ## Live, because a stale roster is worse than no roster
 *
 * A DM reads this and takes 7 off somebody without checking it first, which is why this ticket waited
 * for LIVE-03. The feed is [`useRosterFeed`](./useRosterFeed.ts) — the sheet's own
 * `applyEventToCharacter`, applied to a list — and the connection treatment is LIVE-03's
 * `components/live/` modules rather than a second one: `LiveStatusNotice` above the rows, because if
 * the feed is down then *every* line below is a number that has stopped moving, and `PresenceBadge`
 * per Member, decided from one subscription for the whole list.
 *
 * ## What a reader may do is the server's rule, drawn
 *
 * The quick actions are **absent** for a `player` rather than present and disabled (v3 Req 49.10), and
 * absent on a DM's own character too, because `requireCharacterDM` refuses that. The membership
 * actions are GAM-04's, wording and confirmations intact.
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5, 39.6, 39.7, 40.4, 40.6, 44.8, 49.7, 49.8, 49.9, 49.10**
 */

import { useState } from 'react';
import { LiveStatusNotice } from '../../live/LiveStatusNotice';
import { PRESENCE_STATE, presenceStateOf } from '../../live/presenceState';
import { useLiveRoom } from '../../live/useLiveRoom';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Text } from '../../ui/Text/Text';
import { alertStyles, sectionStyles } from '../sessions.style';
import { MemberGroup } from './MemberGroup';
import type { LobbyAction, PendingAction } from './rosterActions';
import { CONFIRMATION, LOBBY_ACTION } from './rosterActions';
import type { SessionRosterState } from './useSessionRoster';

export interface SessionRosterProps {
  /** Which table this is, so the roster can watch its live feed */
  sessionId: string;
  /**
   * Everything the roster reads, **without its two writes**
   *
   * The manager wraps `remove` and `transfer` so the games listing reloads over one that landed;
   * handing the raw pair out as well would put two live routes to one action on the same surface, and
   * the unwrapped one silently skips that reload (GAM-04's finding, kept).
   */
  roster: Omit<SessionRosterState, 'remove' | 'transfer'>;
  /** False for an archived table, where the server refuses to hand the game over */
  canTransfer: boolean;
  /** False for an archived table, where the server refuses to create a character */
  canCreate: boolean;
  onRemove: (accountId: string) => void;
  onTransfer: (accountId: string) => void;
}

export function SessionRoster({
  sessionId,
  roster,
  canTransfer,
  canCreate,
  onRemove,
  onTransfer,
}: SessionRosterProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);

  // One feed for the whole list. Every badge is decided from it, so a table of six players holds one
  // subscription rather than six.
  const room = useLiveRoom(sessionId);

  const confirm = () => {
    if (!pending) return;

    if (pending.action === LOBBY_ACTION.TRANSFER) onTransfer(pending.accountId);
    else onRemove(pending.accountId);

    setPending(null);
  };

  const ask = (action: LobbyAction, accountId: string, name: string) => {
    setPending({ action, accountId, name });
  };

  const question = pending ? CONFIRMATION[pending.action] : null;

  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Who is at this table
        </Text>
        <Text variant="body-small-secondary" as="p">
          Every number here is worked out from the copy of the rules this game plays by, so it is
          the same for everybody at the table.
        </Text>

        {roster.error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {roster.error}
            </Text>
          </div>
        )}

        {/* Above the rows rather than beside one of them: if the feed is down, *every* line below is
            a number that has stopped moving, and saying so once is what stops a reader taking the
            list as current (v3 Req 44.8) */}
        <LiveStatusNotice sessionId={sessionId} />

        {roster.isPending && roster.groups.length === 0 ? (
          <Text variant="caption" as="p">
            Checking who is here…
          </Text>
        ) : (
          roster.groups.map((group) => {
            // The departed group has nobody whose connection could be asked about, so it is not
            // asked. Substituting `''` here would have taken the live-feed branch and answered
            // `AWAY` — an *away* about a non-person that the feed never supported, which is the one
            // claim TICKET-LIVE-03 spent a criterion making impossible.
            const presence =
              group.member === null
                ? PRESENCE_STATE.UNKNOWN
                : presenceStateOf(room, group.member.accountId);

            return (
              <MemberGroup
                key={group.key}
                group={group}
                presence={presence}
                words={roster.words}
                isDm={roster.isDm}
                canTransfer={canTransfer}
                isBusy={roster.isBusy}
                actsAsDm={roster.actsAsDm}
                adjustments={roster.adjustments}
                onOpenCharacter={roster.openCharacter}
                onAsk={ask}
              />
            );
          })
        )}

        {canCreate ? (
          <div className="flex items-start">
            <Button
              variant="primary"
              size="sm"
              disabled={roster.isOpeningRules}
              onClick={roster.makeCharacterHere}
            >
              {roster.isOpeningRules ? 'Opening the rules…' : 'Make a character here'}
            </Button>
          </div>
        ) : (
          // The server's own answer, said before the click rather than as a 409 after it
          <Text variant="body" as="p">
            This game has been archived, so no new characters can be made in it.
          </Text>
        )}
      </section>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={question?.title ?? ''}
      >
        <div className="flex flex-col gap-4">
          <Text variant="body" as="p">
            {pending && question ? question.body(pending.name) : ''}
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
