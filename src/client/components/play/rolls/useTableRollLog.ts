/**
 * One character's rolls at a table, read once and then kept live (TICKET-ROLL-07, TICKET-LIVE-02)
 *
 * **Split out of `useRoller` by TICKET-LIVE-02**, and the split is the DM-05 precedent rather than a
 * complexity dodge: *what has been rolled* and *how a roll is made* are two subjects, and this ticket
 * gave the first one a second source. `fallow` measured the merged hook at 18 cognitive against a
 * threshold of 15 — it was at exactly 15 before — which is what made the seam obvious rather than
 * what created it.
 *
 * ## Two sources, one order
 *
 * The log arrives from `GET /api/sessions/:id/rolls` on mount and from the table's room thereafter,
 * and a Player's own roll comes back a **third** way — as the answer to their own `POST`. All three
 * go through {@link withRoll}, so a row cannot appear twice (deduplicated by the Event's id, which
 * is the id the route minted) and rows cannot be out of order (sorted by `seq`, which is the log's
 * own order rather than the network's). That function moved to
 * [`rollLog.ts`](./rollLog.ts) at TICKET-DM-04, which gave it a second caller.
 *
 * **Scoped to one character, and to the reader's own Account** — which is what makes this a
 * *Player's* log. TICKET-DM-04 settled the consequence LIVE-02 recorded: a DM reading somebody
 * else's sheet is narrowed to their own rolls and therefore sees none, so rather than widen this
 * read the sheet **defers** — [`useRoller`](./useRoller.ts) hands the panel a sentence pointing at
 * the session roster, where the table's whole log is read unnarrowed
 * ([`useSessionRollLog`](../../sessions/roster/useSessionRollLog.ts)). The alternative — letting the
 * live feed fill an otherwise-empty panel — was rejected then and is still rejected: it would look
 * right and silently omit everything from before the socket opened. `logRoomFor`'s DM branch and its
 * test stand unchanged.
 *
 * **Validates: v3 Req 41.6, 44.7**
 */

import { useEffect, useState } from 'react';
import type { RollLogPayload, SessionRoll } from '#shared/types/api';
import { ROLL_EVENT } from '#shared/types/api';
import type { LiveEvent } from '#shared/types/liveSocket';
import { fetchSessionRolls } from '../../../services/characterSync';
import { useAuth } from '../../auth/useAuth';
import { useLiveSession } from '../shared/useLiveSession';
import { withRoll } from './rollLog';

/**
 * The log row one broadcast Event makes, if it is a roll and it is this character's
 *
 * At module scope rather than inside the listener, so the branches are this function's rather than
 * the hook's — the shape TICKET-DM-05 established when `useSpellbook` shed `choosePool`.
 *
 * @param event What happened at the table
 * @param characterId Whose log this is
 * @param characterName What to call them — resolved here, never stored in the payload
 * @returns The row, or `null` when this Event does not belong in this log
 */
function rollFrom(
  event: LiveEvent,
  characterId: string,
  characterName: string
): SessionRoll | null {
  if (event.type !== ROLL_EVENT) return null;

  const payload = event.payload as RollLogPayload;

  if (payload.characterId !== characterId) return null;

  return {
    ...payload.outcome,
    id: event.id,
    seq: event.seq,
    characterId: payload.characterId,
    // The sheet's own name, because these rows are this character's. The *log's* names are resolved
    // server-side at read time (`listRolls`), and a name inside the Event's payload would be a
    // stored copy that a rename could make wrong.
    characterName,
    rolledBy: null,
  };
}

/** What the log hands back */
export interface TableRollLog {
  /** This character's rolls at the table, newest first */
  history: SessionRoll[];
  /** Put one in — what a Player's own `POST` answer goes through */
  adopt: (roll: SessionRoll) => void;
}

/**
 * Read and then follow one character's rolls at a table
 *
 * @param characterId Whose log
 * @param sessionId Which table, or `null` for a character that plays at none
 * @param characterName What to call them on a row that arrives live
 * @returns The log, and the way to add a roll this browser just made
 */
export function useTableRollLog(
  characterId: string,
  sessionId: string | null,
  characterName: string
): TableRollLog {
  // Whose rolls to ask for. The Player's own, because `requireCharacterPlayer` means nobody else
  // could have rolled this character — the id is what the log is keyed by, so it is what narrows it
  const { accountId } = useAuth();

  const [history, setHistory] = useState<SessionRoll[]>([]);

  /**
   * Read the log once, when the sheet opens
   *
   * **Narrowed by the route rather than here.** The log is capped, so filtering a table-wide window
   * in the browser is how a Player's own rolls fall off their own sheet on a busy table — the review
   * caught that, and `?rolledBy=` is the fix.
   *
   * **What comes back is *folded into* what is on screen, never written over it.** The window is
   * real rather than theoretical: the server's fan-out is synchronous with the write, so a roll
   * made after this `SELECT` ran and before its response landed arrives as a frame first — and a
   * `setHistory(rows)` would throw it away, leaving a log that is missing the newest roll until
   * something else happens. Folding is safe precisely because it is the same `withRoll` the live
   * path uses: a row the read and the frame both carry is deduplicated by the Event's id.
   */
  useEffect(() => {
    if (sessionId === null || !accountId) return;

    let live = true;

    void fetchSessionRolls(sessionId, accountId)
      .then(({ rolls }) => {
        if (!live) return;

        const mine = rolls.filter((roll) => roll.characterId === characterId);

        setHistory((current) => mine.reduce(withRoll, current));
      })
      .catch(() => {
        // A log that cannot be read is not a reason to break the sheet: the rolls still happened
        // and the Player can still make more. It reports itself by staying as it was.
      });

    return () => {
      live = false;
    };
  }, [sessionId, accountId, characterId]);

  useLiveSession(sessionId, (message) => {
    const logged = rollFrom(message.event, characterId, characterName);

    if (logged === null) return;

    setHistory((current) => withRoll(current, logged));
  });

  return {
    history,
    adopt: (roll) => setHistory((current) => withRoll(current, roll)),
  };
}
