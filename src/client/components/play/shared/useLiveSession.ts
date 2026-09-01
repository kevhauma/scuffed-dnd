/**
 * Listen to a table for as long as a surface is on screen (TICKET-LIVE-02)
 *
 * The one place a play-mode surface joins a room. Two callers on the sheet today — the character
 * feed and the roll log — which is why the connection under it counts its rooms: the second hook
 * unmounting must not take the first one's feed with it.
 *
 * **Nobody signed in asks for a socket at all**, which is
 * [D6](../../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)
 * rather than an optimisation — the same gate `useOpenTableCharacter` puts in front of its first
 * request. `isPending` is a real third state: subscribing before the cookie has resolved would open
 * a connection the server closes with `4401`, and nothing here would retry it.
 *
 * **The listener is held in a ref rather than depended on.** A caller passes a fresh closure every
 * render — none of them memoises, and none should have to — so a dependency on it would leave and
 * rejoin the room on every keystroke anywhere on the sheet. The room is keyed on the session and
 * nothing else.
 *
 * **Validates: v3 Req 44.2, 44.7**
 */

import { useEffect, useRef } from 'react';
import type { LiveEventMessage } from '#shared/types/liveSocket';
import { liveConnection } from '../../../services/liveSocket';
import { useAuth } from '../../auth/useAuth';

/**
 * Hear every Event from one table while this component is mounted
 *
 * @param sessionId Which table, or `null` when there is none to listen to
 * @param onEvent What to do with each Event — called with the whole message, room included
 */
export function useLiveSession(
  sessionId: string | null,
  onEvent: (message: LiveEventMessage) => void
): void {
  const { isSignedIn } = useAuth();

  const listener = useRef(onEvent);
  listener.current = onEvent;

  useEffect(() => {
    if (!isSignedIn || sessionId === null) return;

    const connection = liveConnection();

    connection.subscribe(sessionId);

    const stop = connection.addListener((message) => {
      // Rooms are per session and one connection may hold several, so a surface listening to one
      // table must not read another's — the frame says which, and this is where that is honoured
      if (message.sessionId !== sessionId) return;

      listener.current(message);
    });

    return () => {
      stop();
      connection.unsubscribe(sessionId);
    };
  }, [isSignedIn, sessionId]);
}
