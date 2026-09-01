/**
 * Opening a sheet for a character that lives on the server (TICKET-PLY-01)
 *
 * **The bridge between two stores, and it is a hook because neither store may call the other.**
 * `configStore` already imports `characterStore` — it clears the roster when a User starts fresh —
 * so `openTableCharacter` deliberately hands back the session id rather than opening the Snapshot
 * itself, and something above both has to do the second half. That something is this.
 *
 * ## Why the order matters, and why there is a flag
 *
 * The character says which table it plays at, and the table says which rules it is priced by, so the
 * two reads are sequential and cannot be otherwise. In between them the sheet would be holding a
 * server character beside the *browser's* ruleset, which `resolveStatus` correctly calls a
 * configuration mismatch — a real state, rendered as a dead end, for about eighty milliseconds. So
 * the flag stays true across both reads and the sheet renders *opening* rather than a wrong answer.
 *
 * ## Nobody signed in asks the server anything
 *
 * The gate is `useAuth`, and it is D6 rather than an optimisation: a stale `/play/character/<id>`
 * link in a signed-out browser has always ended at *Character Not Found*, and a version that first
 * asked the server about it would be local mode making a request it never used to make. `isPending`
 * is a real third state here — asking before the cookie has resolved would answer *not found* for
 * somebody who is signed in — so the effect waits for it, which is the same reason `AppShell` does.
 *
 * **Validates: v3 Req 36.2, 40.4, 41.1**
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useAuth } from '../../auth/useAuth';
import { useTableCharacterFeed } from './useTableCharacterFeed';

/**
 * Make sure the sheet's character is loaded, fetching it from its table when it is not local — and
 * keep it in step with the table afterwards
 *
 * **The feed is mounted here rather than by `CharacterSheet`** (TICKET-LIVE-02). Two reasons, and
 * the second is the load-bearing one. The reads and the re-read have to be the *same* two calls, and
 * this is the hook that owns them — a fallback spelled a second time in the feed is one that can
 * drift, and the copy that rots is the one nobody looks at. And `CharacterSheet` is at the
 * complexity threshold: `fallow` measured it at 15 cognitive against a limit of 15 before this
 * ticket, and a second hook call took it to 16. Composing the two here leaves that component's diff
 * **comments only**, which is the same property TICKET-DM-05 protected and TICKET-DM-03 recorded a
 * hotspot row for.
 *
 * @param characterId The id the route named
 * @returns Whether a read is still in flight, so the sheet can wait rather than guess
 */
export function useOpenTableCharacter(characterId: string): boolean {
  const { isSignedIn } = useAuth();
  const isLoaded = useCharacterStore((state) => state.isLoaded);
  const isLocal = useCharacterStore((state) =>
    state.characters.some((candidate) => candidate.id === characterId)
  );
  const isOpen = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const openTableCharacter = useCharacterStore((state) => state.openTableCharacter);
  const openSessionSnapshot = useConfigStore((state) => state.openSessionSnapshot);

  const [isOpening, setIsOpening] = useState(false);

  /**
   * Which character this hook has already started opening
   *
   * **The browser check found why this is a ref and not a cancellation flag.** The first draft
   * cleaned up with `cancelled = true` and skipped `setIsOpening(false)` when it had been cancelled
   * — which is the ordinary shape, and it deadlocked here: succeeding sets `tableCharacter`, that
   * flips `isOpen`, `isOpen` is a dependency, so the effect re-runs and its cleanup cancels the very
   * settle its own success had just earned. The sheet sat on *Opening this character…* forever with
   * two 200s behind it.
   *
   * A ref recording *what has been attempted* is the honest guard: it makes the effect idempotent
   * against both the re-run and React's development double-invoke, and lets the settle be
   * unconditional. It is per-mount, so leaving the sheet and coming back retries.
   */
  const opening = useRef<string | null>(null);

  /** The character, then its table's rules — in that order, because the first says which table */
  const read = useCallback(async () => {
    const sessionId = await openTableCharacter(characterId);

    if (sessionId === null) return;

    await openSessionSnapshot(sessionId);
  }, [characterId, openTableCharacter, openSessionSnapshot]);

  useEffect(() => {
    // Before hydration there is no answer to *is it local*, and asking the server for a character
    // LocalStorage is about to produce would be a request D6 says a signed-out visitor never makes
    if (!isSignedIn || !isLoaded || isLocal || isOpen) return;
    if (opening.current === characterId) return;

    opening.current = characterId;
    setIsOpening(true);

    void read().finally(() => setIsOpening(false));
  }, [characterId, isSignedIn, isLoaded, isLocal, isOpen, read]);

  // …and once it is open, keep it that way: an Event the feed cannot apply falls back to `read`,
  // which is the very pair of calls above rather than a second spelling of them
  useTableCharacterFeed(characterId, read);

  return isOpening;
}
