/**
 * One re-read for a burst, and a trailing pass (TICKET-DM-04, v3 Req 44.6, 44.7)
 *
 * Split out of [`useRosterFeed`](./useRosterFeed.ts) when `fallow` measured that hook at **17
 * cognitive against a threshold of 15**. It is the split DM-05 and LIVE-03 both made on the same
 * grounds, and it is a split of subjects rather than a way of moving a number: *what an Event means to
 * a character* is the feed's question, and *when to ask the server again* is this one's. The feed
 * still owns the applier; this owns nothing but timing.
 *
 * ## The three rules it exists to hold
 *
 * **A reason schedules rather than starts.** A DM handing out four items in a second produces four
 * reasons and one request.
 *
 * **A reason arriving while a read runs sets a flag rather than queueing a second request**, and one
 * trailing read runs when the first settles — because an Event that arrived *during* a read may not be
 * in what that read returned, and stopping there would leave the surface quietly a step behind.
 *
 * **A change that was applied cleanly also needs the trailing pass.** This is the subtle one, and it
 * is why {@link CoalescedReads.noteAppliedChange} exists: the read on the wire was composed *before*
 * that change and will overwrite it when it lands. Without the pass that follows, a roster that had
 * correctly patched itself would be silently reverted by an older answer.
 *
 * ## Two things can be stale, and only one of them usually is
 *
 * A character going stale needs the characters read again. A Snapshot refresh needs the **rules**,
 * because every number on the roster is priced against them — and that is the more expensive read, so
 * it is asked for only when something actually asked for it. `alsoRules` accumulates across a burst:
 * if any reason in the window wanted the rules, the one read that follows brings them.
 *
 * **Validates: v3 Req 44.6, 44.7**
 */

import { useCallback, useEffect, useRef } from 'react';
import { useLiveRoom } from '../../live/useLiveRoom';

/**
 * How long a re-read waits before it runs
 *
 * `useTableCharacterFeed`'s window and its reasoning: long enough that a burst of adjustments
 * collapses into one read, short enough that nobody watching calls it a delay. It is a coalescing
 * window rather than a debounce on typing, so it is measured in frames.
 */
const COALESCE_MS = 120;

/** How the roster re-reads each of the two things an Event can make stale */
export interface RosterReads {
  /** The table's characters — the listing hook's own read */
  characters: () => Promise<void>;
  /** The table's Snapshot, for the one Event that moves the rules underneath every number */
  rules: () => Promise<void>;
}

/** What a caller does about a surface that may have gone out of date */
export interface CoalescedReads {
  /**
   * Ask for a re-read, once, however many reasons arrive together
   *
   * @param alsoRules Whether this reason needs the Snapshot as well as the characters
   */
  schedule: (alsoRules: boolean) => void;
  /**
   * Say that something landed which a read already in flight would overwrite
   *
   * Schedules nothing on its own — with no read running there is nothing to correct. See the module
   * note for why an *applied* change needs this at all.
   */
  noteAppliedChange: () => void;
}

/**
 * Keep one surface's re-reads down to one per burst
 *
 * @param sessionId Which table, or `null` when there is none — a *read it all again* arrives here
 * @param reads How to read the surface's two halves
 * @returns The two things a caller does about staleness
 */
export function useCoalescedReads(sessionId: string | null, reads: RosterReads): CoalescedReads {
  /** The scheduled re-read, if one is waiting, and whether it has to bring the rules too */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantsRules = useRef(false);

  /** Whether one is running, and whether another became necessary while it ran */
  const reading = useRef(false);
  const again = useRef(false);

  /** The current reads, so a timer's callback never fires an old closure */
  const read = useRef(reads);
  read.current = reads;

  /**
   * Whether the surface is still on screen
   *
   * **A cleared timer is not enough**: a read already in flight when the row closes settles
   * afterwards, and its `.finally` would fire the trailing re-read into a component nobody is
   * looking at.
   */
  const mounted = useRef(true);

  const schedule = useCallback((alsoRules: boolean) => {
    if (alsoRules) wantsRules.current = true;

    if (reading.current) {
      again.current = true;
      return;
    }

    if (timer.current !== null) return;

    timer.current = setTimeout(() => {
      timer.current = null;
      reading.current = true;

      const bringRules = wantsRules.current;
      wantsRules.current = false;

      // Each call is bound before it is passed on, the house rule — and it reads better here too:
      // *these are the reads in flight* is the thing the line is about
      const current = read.current;
      const characterRead = current.characters();
      const rulesRead = bringRules ? current.rules() : null;
      const inFlight = rulesRead === null ? [characterRead] : [characterRead, rulesRead];
      const settled = Promise.all(inFlight);

      void settled.finally(() => {
        reading.current = false;

        // Something happened while we were asking, so what came back is already behind
        if (!again.current) return;

        again.current = false;

        if (!mounted.current) return;

        void read.current.characters();
      });
    }, COALESCE_MS);
  }, []);

  const noteAppliedChange = useCallback(() => {
    if (reading.current) again.current = true;
  }, []);

  // *Read it all again* (v3 Req 44.6) — through the same timer, so a resync arriving beside a burst
  // of Events is still one read. The rules come too: a client that has been gone long enough to be
  // told this has been gone long enough for the table's Snapshot to have been refreshed. A timestamp
  // rather than a flag, so this fires once per instruction and nobody has to own clearing it.
  const room = useLiveRoom(sessionId);
  const resyncAt = room?.resyncAt ?? null;

  useEffect(() => {
    if (resyncAt === null) return;

    schedule(true);
  }, [resyncAt, schedule]);

  useEffect(() => {
    // Set as well as cleared: a ref survives a remount, and a hook that only ever cleared this
    // would be dead the second time a row was opened
    mounted.current = true;

    return () => {
      mounted.current = false;
      reading.current = false;
      again.current = false;
      wantsRules.current = false;

      if (timer.current === null) return;

      clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  return { schedule, noteAppliedChange };
}
