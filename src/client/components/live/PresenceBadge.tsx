/**
 * One Member's connection, in three words or fewer (TICKET-LIVE-03)
 *
 * The column TICKET-GAM-04 left reading *Connection unknown* on every row because the app could not
 * observe presence. It can now, and this draws what it observes — including *unknown*, which is
 * still the answer whenever there is no live feed to ask. `presenceStateOf` is where that judgement
 * is made; this file only knows how to say it.
 *
 * **Presentational on purpose.** It takes a decided state rather than a room, so the lobby reads one
 * feed and renders many rows, and TICKET-DM-04's roster does the same without every row of a fight
 * subscribing to its own socket.
 *
 * **Validates: v3 Req 44.8**
 */

import { awayBadgeStyles, presentBadgeStyles, unknownBadgeStyles } from './live.style';
import { PRESENCE_STATE, type PresenceState } from './presenceState';

/** What each state is called, and how it is set */
const PRESENCE_BADGE: Record<PresenceState, { label: string; className: string }> = {
  [PRESENCE_STATE.PRESENT]: { label: 'Connected', className: presentBadgeStyles },
  [PRESENCE_STATE.AWAY]: { label: 'Away', className: awayBadgeStyles },
  // The wording GAM-04 chose, kept: it says what is true — *we cannot tell* — where *Offline* would
  // be a claim about somebody made from a connection we do not have
  [PRESENCE_STATE.UNKNOWN]: { label: 'Connection unknown', className: unknownBadgeStyles },
};

export interface PresenceBadgeProps {
  state: PresenceState;
}

export function PresenceBadge({ state }: PresenceBadgeProps) {
  const badge = PRESENCE_BADGE[state];

  return <span className={badge.className}>{badge.label}</span>;
}
