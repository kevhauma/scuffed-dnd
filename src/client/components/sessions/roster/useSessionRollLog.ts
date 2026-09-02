/**
 * The whole table's rolls, read once and then kept live (TICKET-DM-04, v3 Req 41.6, 49.9)
 *
 * [`useTableRollLog`](../../play/rolls/useTableRollLog.ts)'s table-wide sibling, and the surface
 * TICKET-LIVE-02's criterion 4 said did not exist yet. Same two sources and the same
 * [`withRoll`](../../play/rolls/rollLog.ts) fold — a row cannot appear twice, and rows are ordered by
 * `seq` rather than by arrival.
 *
 * ## This is the gap DM-05 and LIVE-02 recorded, closed
 *
 * A DM reading a player's sheet sees an empty roll history, because that log is narrowed to the
 * reader's own Account (`?rolledBy=`) and a DM has never rolled as somebody else's character. The two
 * tickets left it deliberately rather than papering over it with a live feed, which would have filled
 * an empty panel from socket-open and silently omitted everything before that.
 *
 * **This read is narrowed by nothing at all**, which is why it is the honest fix: `listRolls` answers
 * the table's log by default — its own docblock says so and calls it DM-04's — so the roster is
 * complete from the table's first roll, not from the moment a socket opened. The sheet's panel now
 * points here instead of drawing an empty list.
 *
 * **Every Member reads it**, not just the DM. The server has always allowed that (a game is played out
 * loud), and a player watching their party's rolls go past is the same feature.
 *
 * ## Two names, resolved here rather than stored
 *
 * A fetched row arrives with its character and Account already spelled — `listRolls` resolves both at
 * read time so a rename cannot leave the log calling somebody by a name they no longer have. A **live**
 * row carries ids, so the same spelling has to happen on this side; {@link RollNames} is how the
 * roster, which is holding both listings anyway, lends it. Writing a name into the Event payload would
 * be the stored copy both ends have refused all milestone.
 *
 * **Validates: v3 Req 41.6, 44.7, 49.9**
 */

import { useEffect, useRef, useState } from 'react';
import type { RollLogPayload, SessionRoll } from '#shared/types/api';
import { ROLL_EVENT } from '#shared/types/api';
import type { LiveEvent } from '#shared/types/liveSocket';
import { fetchSessionRolls } from '../../../services/characterSync';
import { withRoll } from '../../play/rolls/rollLog';
import { useLiveSession } from '../../play/shared/useLiveSession';

/** How this table spells the two things a roll names */
export interface RollNames {
  /** What a character at this table is called, given its id */
  character: (characterId: string) => string;
  /** What an Account is called, or `null` for the server itself or somebody no longer here */
  account: (accountId: string | null) => string | null;
}

/** What the roster's log hands back */
export interface SessionRollLog {
  /** Every roll at the table, newest first */
  rolls: SessionRoll[];
  /** True while the first read is in flight */
  isPending: boolean;
}

/**
 * The log row one broadcast Event makes, if it is a roll
 *
 * At module scope rather than inside the listener, `rollFrom`'s shape one folder over — the branches
 * are this function's rather than the hook's.
 *
 * @param event What happened at the table
 * @param names How this table spells a character and an Account
 * @returns The row, or `null` when the Event is not a roll
 */
function rollFrom(event: LiveEvent, names: RollNames): SessionRoll | null {
  if (event.type !== ROLL_EVENT) return null;

  const payload = event.payload as RollLogPayload;
  const characterName = names.character(payload.characterId);
  const rolledBy = names.account(event.actorAccountId);

  return {
    ...payload.outcome,
    id: event.id,
    seq: event.seq,
    characterId: payload.characterId,
    characterName,
    rolledBy,
  };
}

/**
 * Read and then follow the whole table's rolls
 *
 * @param sessionId Which table, or `null` when no row is open
 * @param names How to spell a character and an Account on a row that arrives live
 * @returns The log
 */
export function useSessionRollLog(sessionId: string | null, names: RollNames): SessionRollLog {
  const [rolls, setRolls] = useState<SessionRoll[]>([]);
  const [isPending, setIsPending] = useState(false);

  /** Held in a ref so a fresh resolver each render does not re-open the room */
  const spell = useRef(names);
  spell.current = names;

  /**
   * Read the log once, when the row opens
   *
   * **What comes back is folded into what is on screen, never written over it** —
   * `useTableRollLog`'s reasoning: the server's fan-out is synchronous with the write, so a roll made
   * after this `SELECT` ran and before its answer landed arrives as a frame first, and a bare
   * `setRolls(rows)` would throw it away. Folding is safe because it is the same `withRoll` the live
   * path uses, and a row both carry is deduplicated by the Event's id.
   */
  useEffect(() => {
    if (sessionId === null) {
      setRolls([]);
      return;
    }

    let live = true;
    setIsPending(true);

    void fetchSessionRolls(sessionId)
      .then((listing) => {
        if (!live) return;

        setRolls((current) => listing.rolls.reduce(withRoll, current));
      })
      .catch(() => {
        // A log that cannot be read is not a reason to break the roster: the rolls still happened
        // and every other column is still true. It reports itself by staying empty.
      })
      .finally(() => {
        if (live) setIsPending(false);
      });

    return () => {
      live = false;
    };
  }, [sessionId]);

  useLiveSession(sessionId, (message) => {
    const logged = rollFrom(message.event, spell.current);

    if (logged === null) return;

    setRolls((current) => withRoll(current, logged));
  });

  return { rolls, isPending };
}
