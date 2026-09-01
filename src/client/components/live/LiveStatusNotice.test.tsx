/**
 * Saying so when a surface has stopped being current (TICKET-LIVE-03, v3 Req 44.8, 44.9)
 *
 * Two silences and three sentences, and the silences are the part worth testing: **live** says
 * nothing because a correct screen needs no caption, and **connecting** says nothing because on a
 * first load nothing is stale yet — the surface read its state over HTTP a moment ago. A banner
 * there would be alarming about a page that is perfectly current, and it would appear on every page
 * load.
 *
 * The three that speak all say the same second thing: **your actions still work** (v3 Req 44.9). A
 * dropped socket costs a Player the liveness of other people's changes and nothing else, and a
 * notice that did not say so would send somebody off to reload before making a move they could
 * safely have made.
 *
 * **Validates: v3 Req 44.8, 44.9**
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_STATUS, type LiveRoomView, type LiveStatus } from '../../services/liveSocket';
import { LiveStatusNotice } from './LiveStatusNotice';
import { useLiveRoom } from './useLiveRoom';

vi.mock('./useLiveRoom');

/** A room in some state */
function roomView(status: LiveStatus): LiveRoomView {
  return { status, presentAccountIds: [], resyncAt: null };
}

/** Draw the notice for a feed in some state */
function renderNotice(view: LiveRoomView | null) {
  vi.mocked(useLiveRoom).mockReturnValue(view);

  render(<LiveStatusNotice sessionId="session-1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LiveStatusNotice', () => {
  it('says nothing about a character that plays at no table', () => {
    renderNotice(null);

    const notice = screen.queryByRole('status');

    expect(notice).toBeNull();
  });

  it('says nothing while the feed is live', () => {
    const live = roomView(LIVE_STATUS.LIVE);
    renderNotice(live);

    const notice = screen.queryByRole('status');

    expect(notice).toBeNull();
  });

  it('says nothing while the first connection is still being made', () => {
    // Nothing is stale on a first load, so there is nothing to warn about — and this is the state a
    // sheet passes through on every single page load
    const connecting = roomView(LIVE_STATUS.CONNECTING);
    renderNotice(connecting);

    const notice = screen.queryByRole('status');

    expect(notice).toBeNull();
  });

  it('says the table is not connected once something has been lost', () => {
    const reconnecting = roomView(LIVE_STATUS.RECONNECTING);
    renderNotice(reconnecting);

    const notice = screen.getByRole('status');

    expect(notice.textContent).toContain('Not connected to this table');
    expect(notice.textContent).toContain('may be out of date');
  });

  it('promises that actions still work, wherever it speaks', () => {
    // v3 Req 44.9 as a sentence rather than as a mechanism. A notice that only said *this may be
    // stale* would send a Player off to reload before making a change they could safely make.
    const speaking = [LIVE_STATUS.RECONNECTING, LIVE_STATUS.OFFLINE];

    for (const status of speaking) {
      const view = roomView(status);
      renderNotice(view);
    }

    const notices = screen.getAllByRole('status');
    const promises = notices.filter((notice) => {
      const words = notice.textContent ?? '';
      return words.includes('still works and still saves');
    });

    expect(notices).toHaveLength(speaking.length);
    expect(promises).toHaveLength(speaking.length);
  });

  it('says a lost room will not come back, rather than that it is retrying', () => {
    // The one state nothing will fix: refused, or taken away. Telling this reader that we are
    // *reconnecting* would promise a recovery that is not coming.
    const lost = roomView(LIVE_STATUS.LOST);
    renderNotice(lost);

    const notice = screen.getByRole('status');

    expect(notice.textContent).toContain('updates have stopped');
    expect(notice.textContent).not.toContain('trying again');
  });
});
