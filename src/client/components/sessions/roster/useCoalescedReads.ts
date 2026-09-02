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
 * ## Three things can be stale, and usually only one of them is
 *
 * A character going stale needs the characters read again. A Snapshot refresh needs the **rules**,
 * because every number on the roster is priced against them. A join needs the **member list**, and
 * only that — its Event carries an id and no name, so there is no row to build (TICKET-LIVE-04).
 * Each read is asked for only by a reason that wanted it, and the set accumulates across a burst: if
 * any reason in the window wanted the rules, the one read that follows brings them.
 *
 * **A named set replaced a boolean when the third arrived.** `schedule(alsoRules)` could say *and
 * the rules too* and had no way to say *the members alone* — and the shortest way to make it say so
 * would have been a second flag, then a third, each caller passing two booleans whose meaning is
 * positional. What a reason wants is a **set of reads**, which is what it now passes.
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

/** Which of the roster's reads a reason needs */
export const ROSTER_READ = {
  /** Every character at the table, with what has happened to them */
  CHARACTERS: 'characters',
  /** The table's Snapshot, which every number on the surface is priced against */
  RULES: 'rules',
  /** Who is at the table, which a join changes and cannot describe (TICKET-LIVE-04) */
  MEMBERS: 'members',
} as const;

/** One of the three */
export type RosterRead = (typeof ROSTER_READ)[keyof typeof ROSTER_READ];

/** How the roster re-reads each of the three things an Event can make stale */
export type RosterReads = Record<RosterRead, () => Promise<void>>;

/** What a caller does about a surface that may have gone out of date */
export interface CoalescedReads {
  /**
   * Ask for a re-read, once, however many reasons arrive together
   *
   * @param reads Which of the roster's halves this reason needs — an empty list asks for nothing
   */
  schedule: (reads: RosterRead[]) => void;
  /**
   * Say that something landed which a read already in flight would overwrite
   *
   * Schedules nothing on its own — with no read running there is nothing to correct. See the module
   * note for why an *applied* change needs this at all.
   *
   * @param half Which read would overwrite it — the one that has to run again afterwards
   */
  noteAppliedChange: (half: RosterRead) => void;
}

/**
 * Keep one surface's re-reads down to one per burst
 *
 * @param sessionId Which table, or `null` when there is none — a *read it all again* arrives here
 * @param reads How to read the surface's two halves
 * @returns The two things a caller does about staleness
 */
export function useCoalescedReads(sessionId: string | null, reads: RosterReads): CoalescedReads {
  /** The scheduled re-read, if one is waiting, and which halves it has to bring */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wanted = useRef(new Set<RosterRead>());

  /** Whether one is running, and what became necessary while it ran */
  const reading = useRef(false);
  const again = useRef(new Set<RosterRead>());

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

  /**
   * Run one pass of exactly the reads that were asked for
   *
   * @param bring Which halves this pass brings
   * @returns When all of them have settled, however they settled
   */
  const runReads = useCallback((bring: Set<RosterRead>): Promise<unknown> => {
    // Each call is bound before it is passed on, the house rule — and it reads better here too:
    // *these are the reads in flight* is the thing the line is about
    const current = read.current;
    const inFlight = [...bring].map((half) => current[half]());

    return Promise.all(inFlight);
  }, []);

  const schedule = useCallback(
    (asked: RosterRead[]) => {
      // Nothing was asked for, so nothing is promised — a caller that computed an empty set has
      // decided this Event needs no read, and a timer for it would be a request nobody wanted
      if (asked.length === 0) return;

      if (reading.current) {
        for (const half of asked) again.current.add(half);
        return;
      }

      for (const half of asked) wanted.current.add(half);

      if (timer.current !== null) return;

      timer.current = setTimeout(() => {
        timer.current = null;
        reading.current = true;

        const bring = wanted.current;
        wanted.current = new Set();

        const settled = runReads(bring);

        void settled.finally(() => {
          reading.current = false;

          // Something happened while we were asking, so what came back is already behind
          const trailing = again.current;

          if (trailing.size === 0) return;

          again.current = new Set();

          if (!mounted.current) return;

          void runReads(trailing);
        });
      }, COALESCE_MS);
    },
    [runReads]
  );

  const noteAppliedChange = useCallback((half: RosterRead) => {
    // The read on the wire was composed before the change landed and will overwrite it, so the
    // trailing pass brings back **that** half — a patched member list is undone by a member read
    // and by nothing else, and asking for the characters instead would be a request that costs
    // something and fixes nothing
    if (reading.current) again.current.add(half);
  }, []);

  // *Read it all again* (v3 Req 44.6) — through the same timer, so a resync arriving beside a burst
  // of Events is still one read. **All three halves**: a client that has been gone long enough to be
  // told this has been gone long enough for the Snapshot to have been refreshed and for somebody to
  // have joined or left. A timestamp rather than a flag, so this fires once per instruction and
  // nobody has to own clearing it.
  const room = useLiveRoom(sessionId);
  const resyncAt = room?.resyncAt ?? null;

  useEffect(() => {
    if (resyncAt === null) return;

    const everything = Object.values(ROSTER_READ);

    schedule(everything);
  }, [resyncAt, schedule]);

  useEffect(() => {
    // Set as well as cleared: a ref survives a remount, and a hook that only ever cleared this
    // would be dead the second time a row was opened
    mounted.current = true;

    return () => {
      mounted.current = false;
      reading.current = false;
      again.current = new Set();
      wanted.current = new Set();

      if (timer.current === null) return;

      clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  return { schedule, noteAppliedChange };
}
