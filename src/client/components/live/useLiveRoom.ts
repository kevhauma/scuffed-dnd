/**
 * How one table's feed is doing, for as long as a surface is on screen (TICKET-LIVE-03)
 *
 * The read half of the live socket, beside `play/shared/useLiveSession`'s listening half. **Each
 * holds its own subscription and that is the design rather than a duplication**: the connection
 * reference-counts rooms exactly so that several hooks on one surface may each want the same table,
 * and the second one unmounting must not take the first one's feed with it. This one wants the room
 * because a surface cannot say *who is here* about a table it is not watching.
 *
 * **`null` is a real answer**, and it is what a *local* character and a signed-out reader get: there
 * is no feed, rather than a feed that is down. `presenceStateOf` and `LiveStatusNotice` both read it
 * as *nothing to say*, which is what keeps the whole treatment invisible outside connected play
 * ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)).
 *
 * TICKET-DM-04's roster is the second caller, and it is why this answers with a **view object**
 * rather than with the two or three booleans the lobby happens to need.
 *
 * **Validates: v3 Req 44.8**
 */

import { useEffect, useState } from 'react';
import type { LiveRoomView } from '../../services/liveSocket';
import { liveConnection } from '../../services/liveSocket';
import { useAuth } from '../auth/useAuth';

/**
 * Watch one table's feed
 *
 * @param sessionId Which table, or `null` where there is none
 * @returns The room's status and presence, or `null` when there is no feed at all
 */
export function useLiveRoom(sessionId: string | null): LiveRoomView | null {
  const { isSignedIn } = useAuth();
  const [view, setView] = useState<LiveRoomView | null>(null);

  useEffect(() => {
    // Nobody signed in asks for a socket at all (D6) — the same gate `useLiveSession` puts in front
    // of its own subscribe. Cleared rather than left, so a sign-out does not leave a stale view on
    // screen claiming a table is live.
    if (!isSignedIn || sessionId === null) {
      setView(null);
      return;
    }

    const connection = liveConnection();

    connection.subscribe(sessionId);

    const read = () => {
      const current = connection.roomView(sessionId);
      setView(current);
    };

    // Once immediately: the connection may already be open and this room already confirmed, in which
    // case no further notification is coming and a hook that only listened would render *connecting*
    // for as long as the surface stayed open
    read();

    const stop = connection.addViewListener(read);

    return () => {
      stop();
      connection.unsubscribe(sessionId);
    };
  }, [isSignedIn, sessionId]);

  return view;
}
