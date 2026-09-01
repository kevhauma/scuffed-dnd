/**
 * Keeping an open sheet current while other people act on it (TICKET-LIVE-02, TICKET-LIVE-03,
 * v3 Req 44.7)
 *
 * The DM awards 300 experience and the Player's level moves, with nothing pressed and nothing
 * reloaded. That is the whole of what this hook is for.
 *
 * ## Apply what can be applied; ask about the rest
 *
 * Every Event goes to `characterStore.applyTableEvent`, which answers one of three things. **applied**
 * — the sheet now holds the value, and everything derived from it re-renders through the Kernel as
 * it always has. **elsewhere** — somebody else's character, or a roll, which stores nothing; the
 * roll log has its own listener and this must not refetch a sheet every time dice are thrown.
 * **stale** — it was about this sheet and only a re-read can say what the sheet now is: a built
 * item, a learned spell, a Snapshot refresh that moved the rules underneath it.
 *
 * ## One refetch for a burst, never one per Event
 *
 * A `stale` schedules a re-read on a short timer rather than starting one, so a DM handing out four
 * items in a second costs one read and not four. While a read is in flight a further `stale` sets a
 * flag rather than queueing a second request, and one trailing read runs when the first settles —
 * because an Event that arrived *during* a read may not be in what that read returned, and stopping
 * there would leave the sheet quietly a step behind.
 *
 * **The re-read is `useOpenTableCharacter`'s own `reopen`** — the very two reads the sheet opened
 * with. A second spelling of *what a session sheet is made of* is the thing most likely to drift.
 *
 * ## Two things TICKET-LIVE-03 added, both about a read that is already in flight
 *
 * **A resynchronise instruction schedules the same re-read** (v3 Req 44.6). When a client has been
 * gone too long to replay, the server says so rather than sending five hundred frames, and *read it
 * all again* is a thing this hook already knows how to do — through the same coalescing timer, so a
 * resync arriving beside a burst of Events is still one read.
 *
 * **An Event that applied cleanly now also schedules the trailing pass, if a read is running.** It
 * used to be that only a `stale` did. The failure is specific and it defeats the resync above: a
 * re-read is composed on the server *before* the Event lands, the Event arrives and is applied to
 * the sheet, and then the older answer arrives and overwrites it — leaving a sheet that is a step
 * behind with nothing left to correct it. The read that follows is the fix, and it is the same fold
 * `useTableRollLog` performs for the same reason: a live feed and a fetch race, and the fetch is the
 * one that is out of date.
 *
 * **Validates: v3 Req 44.6, 44.7**
 */

import { useCallback, useEffect, useRef } from 'react';
import { EVENT_EFFECT } from '../../../services/liveEvents';
import { useCharacterStore } from '../../../stores/characterStore';
import { useLiveRoom } from '../../live/useLiveRoom';
import { useLiveSession } from '../shared/useLiveSession';

/**
 * How long a `stale` waits before the sheet is re-read
 *
 * Long enough that Events written in one burst — a DM working through a handful of adjustments —
 * collapse into one read, short enough that nobody watching the screen calls it a delay. It is a
 * coalescing window and not a debounce on a *user's* typing, so it is measured in frames rather
 * than in the hundreds of milliseconds `rulesetSync` uses for a save.
 */
const COALESCE_MS = 120;

/**
 * Keep the character open at a table in step with what happens to it
 *
 * @param characterId Which sheet is on screen
 * @param reopen How to read it again — `useOpenTableCharacter`'s
 */
export function useTableCharacterFeed(characterId: string, reopen: () => Promise<void>): void {
  const atTable = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const tableSessionId = useCharacterStore((state) => state.tableSessionId);
  const applyTableEvent = useCharacterStore((state) => state.applyTableEvent);

  /** The scheduled re-read, if one is waiting */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Whether one is running, and whether another became necessary while it ran */
  const reading = useRef(false);
  const again = useRef(false);

  /** The current way to re-read, so the timer's callback never fires an old closure */
  const read = useRef(reopen);
  read.current = reopen;

  /**
   * Whether this sheet is still on screen
   *
   * **A cleared timer is not enough**: a read already in flight when the sheet closes settles
   * afterwards, and its `.finally` would fire the trailing re-read into a component nobody is
   * looking at — a request for a sheet the User has navigated away from, writing a character into a
   * store the next sheet is about to replace.
   */
  const mounted = useRef(true);

  const listening = atTable ? tableSessionId : null;

  /**
   * Ask for the sheet again, once, however many reasons arrive at once
   *
   * Stable — it touches nothing but refs — so the resync effect below can depend on it without
   * rescheduling itself every render.
   */
  const scheduleRead = useCallback(() => {
    if (reading.current) {
      again.current = true;
      return;
    }

    if (timer.current !== null) return;

    timer.current = setTimeout(() => {
      timer.current = null;
      reading.current = true;

      void read.current().finally(() => {
        reading.current = false;

        // Something happened while we were asking, so what came back is already behind
        if (!again.current) return;

        again.current = false;

        if (!mounted.current) return;

        void read.current();
      });
    }, COALESCE_MS);
  }, []);

  useLiveSession(listening, (message) => {
    const effect = applyTableEvent(message.event);

    // Somebody else's character, or a roll, which stores nothing. Not about this sheet either way,
    // so it does not make an in-flight read out of date.
    if (effect === EVENT_EFFECT.ELSEWHERE) return;

    if (effect === EVENT_EFFECT.STALE) {
      scheduleRead();
      return;
    }

    // **Applied — and that is not always the end of it.** The sheet holds the new value, but a read
    // already on the wire was composed before this Event and will overwrite it when it lands. One
    // trailing read after that is what makes the sheet right again; with no read running there is
    // nothing to correct and nothing is scheduled.
    if (reading.current) again.current = true;
  });

  // *Read it all again* (v3 Req 44.6). A timestamp rather than a flag, so this fires once per
  // instruction and nobody has to own clearing it.
  const room = useLiveRoom(listening);
  const resyncAt = room?.resyncAt ?? null;

  useEffect(() => {
    if (resyncAt === null) return;

    scheduleRead();
  }, [resyncAt, scheduleRead]);

  useEffect(() => {
    // Set as well as cleared: a ref survives a remount of the same element, and a hook that only
    // ever cleared this would be dead the second time the sheet opened
    mounted.current = true;

    return () => {
      mounted.current = false;
      reading.current = false;
      again.current = false;

      if (timer.current === null) return;

      clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);
}
