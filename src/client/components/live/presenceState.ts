/**
 * Whether somebody is at the table, or whether we cannot tell (TICKET-LIVE-03)
 *
 * Pure, and separate from the badge that draws it, because it is the ticket's central judgement
 * rather than a rendering detail: **a connection that is not up produces `unknown`, never `away`**.
 *
 * TICKET-GAM-04 wrote *Connection unknown* into the lobby and gave the reason — the app could not
 * tell a player who had closed the tab from one sitting quietly, and writing *Offline* would have
 * been the same mistake as showing a confident zero for a formula that could not be evaluated. This
 * ticket gives the app something real to observe and **keeps that state rather than retiring it**.
 * Unknown stops being the only answer and becomes the honest one for exactly the cases where it is
 * true: no socket, a socket that is down, or a room this reader was refused.
 *
 * The reason it is a function of the **view** rather than of the presence list is that the list on
 * its own cannot say this. An empty list means *nobody is here* when the feed is live and *we have
 * no idea* a second after it drops, and only the status beside it tells the two apart.
 *
 * **Validates: v3 Req 44.8**
 */

import { LIVE_STATUS, type LiveRoomView } from '../../services/liveSocket';

/** What a row may say about one Member's connection */
export const PRESENCE_STATE = {
  /** Their browser is watching this table right now */
  PRESENT: 'present',
  /** The feed is live and they are not on it */
  AWAY: 'away',
  /** There is no live feed to ask — do not draw a conclusion from that */
  UNKNOWN: 'unknown',
} as const;

/** One of the three */
export type PresenceState = (typeof PRESENCE_STATE)[keyof typeof PRESENCE_STATE];

/**
 * What one Member's connection may be said to be
 *
 * @param view The room's feed, or `null` where there is none — signed out, or a local character
 * @param accountId Whose row this is
 * @returns What the badge may claim
 */
export function presenceStateOf(view: LiveRoomView | null, accountId: string): PresenceState {
  if (view === null) return PRESENCE_STATE.UNKNOWN;

  // **Every non-live status is `unknown`**, including one this reader caused by navigating away.
  // *Away* is a claim about the other person; it may only be made from a feed that would have told
  // us otherwise.
  if (view.status !== LIVE_STATUS.LIVE) return PRESENCE_STATE.UNKNOWN;

  const isHere = view.presentAccountIds.includes(accountId);

  return isHere ? PRESENCE_STATE.PRESENT : PRESENCE_STATE.AWAY;
}
