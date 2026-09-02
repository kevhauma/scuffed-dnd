/**
 * The characters at one table (TICKET-CHAR-04)
 *
 * The fourth surface keyed on the open row, over
 * [`useSessionResource`](./useSessionResource.ts) like the other three — so the staleness guard,
 * the 404-means-you-cannot-see-this rule and the busy flag are the ones GAM-04 extracted rather
 * than a fourth copy of them.
 *
 * **There is still no write here.** Creating a character goes through the wizard, which runs against
 * whichever ruleset is open and submits through `characterStore.createCharacterHere` — persistence
 * belongs to the store action, and a second creation path on a listing hook would be a second place
 * for the rule to live. Everything *else* a character does is TICKET-PLY-01's, and this hook's part
 * in it is one `navigate`: the sheet reads its own character and its own rules
 * ([`useOpenTableCharacter`](../play/sheet/useOpenTableCharacter.ts)), so a link is all a listing
 * owes it.
 *
 * **Validates: v3 Req 40.4, 41.1**
 */

import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import type { CharacterDocument, CharacterListing } from '#shared/types/api';
import { useConfigStore } from '../../stores/configStore';
import { SESSIONS_PATH, useSessionResource } from './useSessionResource';

/** What the party surface needs */
export interface SessionCharactersState {
  /** Every character at the table, whoever owns it — a game is played out loud (v3 Req 40.4) */
  characters: CharacterDocument[];
  /** True while the first read is in flight */
  isPending: boolean;
  error: string | null;
  /** True while this table's rules are being opened, so the button cannot be pressed twice */
  isOpeningRules: boolean;
  /**
   * Open this table's pinned Snapshot and go to the creation wizard (v3 Req 40.6)
   *
   * **Here rather than in `useSessionsManager`**, which is what the review asked for and is right
   * on its own terms: this hook already owns *this row's characters*, and making one is the only
   * thing anybody does to that list. The manager was aggregating five per-row resources plus
   * navigation, and this was the piece with somewhere better to live.
   */
  makeCharacterHere: () => void;
  /**
   * Open one character's sheet (TICKET-PLY-01)
   *
   * Only offered for the reader's **own** characters, which is the server's rule showing through:
   * `requireCharacterPlayer` refuses everybody else's writes, so a sheet full of controls nothing
   * could save is not a page worth opening. Reading somebody else's is the roster's job (DM-04).
   */
  openCharacter: (characterId: string) => void;
  /**
   * Read the listing again (TICKET-DM-04)
   *
   * What the roster's live feed calls after an Event it could not apply — a built item, a learned
   * spell, a Snapshot refresh. **The listing hook's own read, handed over rather than re-spelled**,
   * so the feed's fallback and the first load are one request rather than two that could drift.
   */
  reload: () => Promise<void>;
}

/**
 * What a table with no characters read yet is
 *
 * A module-level constant rather than a `[]` in the return, so the array keeps its identity between
 * renders. The roster's feed seeds its own state from this list on a `useEffect` keyed by it; a fresh
 * empty array per render would re-seed — and therefore discard every live patch — on every keystroke
 * anywhere on the page.
 */
const NO_CHARACTERS: CharacterDocument[] = [];

/**
 * Drive one table's characters
 *
 * @param sessionId Which table, or `null` when no table is open
 * @returns The party, and the way to join it
 */
export function useSessionCharacters(sessionId: string | null): SessionCharactersState {
  const { data, isPending, error, reload } = useSessionResource<CharacterListing>(
    sessionId,
    (id) => `${SESSIONS_PATH}/${id}/characters`
  );

  const navigate = useNavigate();
  const openSessionSnapshot = useConfigStore((state) => state.openSessionSnapshot);
  const [isOpeningRules, setIsOpeningRules] = useState(false);

  return {
    characters: data?.characters ?? NO_CHARACTERS,
    isPending,
    error,
    reload,
    isOpeningRules,
    makeCharacterHere: useCallback(() => {
      if (!sessionId || isOpeningRules) return;

      setIsOpeningRules(true);

      // **Only on the way in.** A failed open reports itself through the ruleset banner and leaves
      // whatever was open exactly as it was, so navigating anyway would drop the Player into a
      // wizard running against the wrong rules — the one mistake this whole ticket is about not
      // making.
      void openSessionSnapshot(sessionId)
        .then((opened) => {
          if (opened) navigate({ to: '/play/create' });
        })
        .finally(() => setIsOpeningRules(false));
    }, [sessionId, isOpeningRules, openSessionSnapshot, navigate]),

    openCharacter: useCallback(
      (characterId: string) => {
        navigate({ to: '/play/character/$id', params: { id: characterId } });
      },
      [navigate]
    ),
  };
}
