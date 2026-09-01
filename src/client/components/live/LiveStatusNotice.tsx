/**
 * *What you are looking at may not be current* (TICKET-LIVE-03, v3 Req 44.8)
 *
 * The failure this exists to prevent is one sentence long: a Player reads 12 HP off a screen whose
 * socket died four minutes ago, and acts on it. Every mechanism in this ticket — the reconnect, the
 * replay, the presence — is in service of that, and this is the part the Player actually sees.
 *
 * ## What it says, and the two states it says nothing about
 *
 * **Live** is silent, because a correct screen needs no caption. **Connecting** is silent too, and
 * that is a judgement rather than an oversight: on a first load nothing is stale yet — the surface
 * read its state over HTTP a moment ago — so a banner would be alarming about a page that is
 * perfectly current. The instant a first attempt *fails*, the status moves off `connecting` (see
 * `roomStatusOf`) and this speaks.
 *
 * **Every other state says so, and says what still works.** v3 Req 44.9 is the other half of the
 * message and it is why the wording is calm: actions still go over HTTP and still succeed, so a
 * dropped socket costs a Player the liveness of *other people's* changes and nothing else.
 *
 * ## Drawn unconditionally, and absent by its own decision
 *
 * The shape TICKET-DM-03 measured rather than argued: a caller renders `<LiveStatusNotice
 * sessionId={…} />` with no conditional around it, and the component answers *nothing to say* for a
 * local character, a signed-out reader, and a healthy feed. A `{isStale && …}` at each caller would
 * put the branch — and the props feeding it — in the file the conditional is most expensive in.
 *
 * **Validates: v3 Req 44.8, 44.9**
 */

import { LIVE_STATUS, type LiveStatus } from '../../services/liveSocket';
import { Text } from '../ui/Text/Text';
import { lostNoticeStyles, staleNoticeStyles } from './live.style';
import { useLiveRoom } from './useLiveRoom';

/** What there is to say about a feed that is not live, and how loudly */
const NOTICE: Partial<Record<LiveStatus, { className: string; message: string }>> = {
  [LIVE_STATUS.RECONNECTING]: {
    className: staleNoticeStyles,
    message:
      'Not connected to this table — trying again. What you see may be out of date, but ' +
      'everything you do still works and still saves.',
  },
  [LIVE_STATUS.OFFLINE]: {
    className: staleNoticeStyles,
    message:
      'This table is not live. What you see may be out of date; reload to catch up. Everything ' +
      'you do still works and still saves.',
  },
  [LIVE_STATUS.LOST]: {
    className: lostNoticeStyles,
    message:
      'This table’s updates have stopped — you may no longer be at it. What you see will not ' +
      'change again until you reload.',
  },
};

export interface LiveStatusNoticeProps {
  /** Which table, or `null` for a character that plays at none */
  sessionId: string | null;
}

export function LiveStatusNotice({ sessionId }: LiveStatusNoticeProps) {
  const view = useLiveRoom(sessionId);

  // No feed at all — signed out, or a local character. Not a connection problem, so not a word.
  if (view === null) return null;

  const notice = NOTICE[view.status];

  if (!notice) return null;

  // `<output>` rather than a `div` with `role="status"`: the element carries that role itself, which
  // is what `useSemanticElements` asks for and what a screen reader announces without being told
  return (
    <output className={notice.className}>
      <Text variant="body-small-secondary" as="p">
        {notice.message}
      </Text>
    </output>
  );
}
