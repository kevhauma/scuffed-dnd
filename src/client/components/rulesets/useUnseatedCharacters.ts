/**
 * The characters on this Account that sit at no table (TICKET-CHAR-04)
 *
 * **The half of IO-04 that had no surface.** That ticket's upload wrote `character` rows and its own
 * review flagged what it left behind: nothing listed them, nothing deleted them, and they were
 * invisible to every page a User could reach. v3 Req 40.7 asks that they *not* be silently
 * invisible, and this is what a surface reads to satisfy it.
 *
 * **Keyed on nothing** — unlike the four hooks in `sessions/`, which hang off whichever row is open.
 * This is an Account's own list, so it loads once and re-reads after a delete, which is the only
 * thing that changes it here.
 *
 * **`enabled` rather than an assumption**, matching `useAccountRulesets`: `/rulesets` is deliberately
 * **not** protected — signed out it is the browser's own ruleset, working completely without an
 * account (D6) — so this hook has to be able to do nothing at all.
 *
 * **Validates: v3 Req 40.7, 40.8**
 */

import { useCallback, useEffect, useState } from 'react';
import type { CharacterDocument, CharacterListing } from '#shared/types/api';
import { ApiError, apiRequest } from '../../services/api';

/** Where an Account's own characters live — a relative path, because there is one origin (D1) */
const CHARACTERS_PATH = '/api/characters';

/** What the unseated-characters surface needs */
export interface UnseatedCharactersState {
  characters: CharacterDocument[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  /** True while a delete is on the wire, so a row cannot be removed twice */
  isBusy: boolean;
  error: string | null;
  /** Throw one away; reports whether it landed */
  remove: (characterId: string) => Promise<boolean>;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive the Account's unseated characters
 *
 * @param enabled False signed out, where there is no Account to have any
 * @returns The list and the one thing that can be done to it
 */
export function useUnseatedCharacters(enabled: boolean): UnseatedCharactersState {
  const [characters, setCharacters] = useState<CharacterDocument[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCharacters((await apiRequest<CharacterListing>(CHARACTERS_PATH)).characters);
      // Cleared on success, so a refusal that has stopped being true stops being shown
      setError(null);
    } catch (cause) {
      setError(messageOf(cause));
      setCharacters([]);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCharacters(null);
      setError(null);
      return;
    }

    void load();
  }, [enabled, load]);

  return {
    characters: characters ?? [],
    isPending: enabled && characters === null,
    isBusy,
    error,
    remove: useCallback(
      async (characterId: string) => {
        if (isBusy) return false;

        setIsBusy(true);
        setError(null);

        try {
          await apiRequest<void>(`${CHARACTERS_PATH}/${characterId}`, { method: 'DELETE' });
          await load();
          return true;
        } catch (cause) {
          setError(messageOf(cause));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      [isBusy, load]
    ),
  };
}
