/**
 * Never *away* off a dead connection (TICKET-LIVE-03, v3 Req 44.8)
 *
 * The judgement this whole ticket turns on, in one pure function, so it can be asserted without a
 * socket or a component. The failure it prevents is small and specific: a badge saying *Away* about
 * somebody who is sitting right there, because the reader's own connection dropped four minutes ago.
 *
 * **The interesting cases are all the ones where a list of present Accounts exists and must be
 * ignored** — the states below carry `presentAccountIds` on purpose, so that a version of this
 * function that read the list before the status would pass none of them.
 *
 * **Validates: v3 Req 44.8**
 */

import { describe, expect, it } from 'vitest';
import { LIVE_STATUS, type LiveRoomView, type LiveStatus } from '../../services/liveSocket';
import { PRESENCE_STATE, presenceStateOf } from './presenceState';

/** A room in some state, holding a list of who was last seen there */
function roomView(status: LiveStatus, presentAccountIds: string[] = ['account-ada']): LiveRoomView {
  return { status, presentAccountIds, resyncAt: null };
}

describe('presenceStateOf', () => {
  it('says present for somebody on a live room’s list', () => {
    const live = roomView(LIVE_STATUS.LIVE);
    const state = presenceStateOf(live, 'account-ada');

    expect(state).toBe(PRESENCE_STATE.PRESENT);
  });

  it('says away for somebody a live room does not name', () => {
    const live = roomView(LIVE_STATUS.LIVE);
    const state = presenceStateOf(live, 'account-dm');

    // The one state that is a claim about another person, and it is only ever made from a feed that
    // would have said otherwise
    expect(state).toBe(PRESENCE_STATE.AWAY);
  });

  it('says unknown when there is no feed at all', () => {
    // A local character, or a signed-out reader. GAM-04's original answer, and still the right one.
    const state = presenceStateOf(null, 'account-ada');

    expect(state).toBe(PRESENCE_STATE.UNKNOWN);
  });

  it('says unknown for every state that is not live, even about somebody on the list', () => {
    const notLive: LiveStatus[] = [
      LIVE_STATUS.CONNECTING,
      LIVE_STATUS.RECONNECTING,
      LIVE_STATUS.OFFLINE,
      LIVE_STATUS.LOST,
    ];

    const answers = notLive.map((status) => {
      const view = roomView(status, ['account-ada']);
      return presenceStateOf(view, 'account-ada');
    });

    // **Ada is on every one of those lists.** A function that checked membership before it checked
    // the status would answer *present* four times here, and the lobby would go on telling a DM that
    // a player who left an hour ago is at the table.
    expect(answers).toEqual([
      PRESENCE_STATE.UNKNOWN,
      PRESENCE_STATE.UNKNOWN,
      PRESENCE_STATE.UNKNOWN,
      PRESENCE_STATE.UNKNOWN,
    ]);
  });

  it('says unknown rather than away when a dropped feed has emptied the list', () => {
    // The other order of events, and the one that produces the confident wrong answer: the socket
    // goes, presence is cleared, and *not on the list* would read as *they have left*
    const dropped = roomView(LIVE_STATUS.RECONNECTING, []);
    const state = presenceStateOf(dropped, 'account-ada');

    expect(state).toBe(PRESENCE_STATE.UNKNOWN);
  });

  it('says away for an empty live room, which is a thing we do know', () => {
    const empty = roomView(LIVE_STATUS.LIVE, []);
    const state = presenceStateOf(empty, 'account-ada');

    expect(state).toBe(PRESENCE_STATE.AWAY);
  });
});
