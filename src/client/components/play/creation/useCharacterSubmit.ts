/**
 * Submitting a finished character, to whichever home is open (TICKET-CHAR-04)
 *
 * **Split out of `useCharacterCreation` because the wizard grew a second destination.** That hook
 * owns four steps of form state, an engine preview and a validator; adding a request, a busy flag
 * and a refusal to it pushed it past the complexity the conventions ask a function to stay under,
 * and the half that came out is the half with a different subject: everything here is about *what
 * happens after the last Next*, and nothing here is about what the Player is choosing.
 *
 * **The wizard still does not know where the character goes.** `createCharacterHere` takes the
 * source and decides; this is only what a *surface* owes the Player while it waits — a flag so the
 * button cannot be pressed twice, the refusal in the server's own words, and staying put rather
 * than navigating to a character that was never created.
 *
 * **Validates: v3 Req 40.5, 40.6**
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type { CharacterCreationData } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { RULESET_HOME, type RulesetSource } from '../../../services/rulesetSync';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/** What the wizard's last step needs */
export interface CharacterSubmit {
  /** True while a submit is on the wire — the session path is a request */
  isSubmitting: boolean;
  /** Why the last submit was refused, in the server's own words where there is one */
  submitError: string | null;
  /** Send it. Does nothing while one is already in flight. */
  submit: (data: CharacterCreationData, config: Configuration) => void;
}

/**
 * Drive the wizard's confirm
 *
 * @param source Which ruleset is open, and therefore where the character goes
 * @returns The flag, the refusal, and the act
 */
export function useCharacterSubmit(source: RulesetSource): CharacterSubmit {
  const navigate = useNavigate();
  const createCharacterHere = useCharacterStore((state) => state.createCharacterHere);
  // Put back after a character is made at a table — see below
  const openLocalRuleset = useConfigStore((state) => state.openLocalRuleset);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  return {
    isSubmitting,
    submitError,
    submit: (data: CharacterCreationData, config: Configuration) => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      setSubmitError(null);

      // Persistence belongs to the store action, which is handed the home rather than reaching for
      // it — `configStore` already imports `characterStore`, so reading it back would be a cycle
      void createCharacterHere(source, data, config)
        .then((result) => {
          if (!result.created) {
            setSubmitError(result.message);
            return;
          }

          if (source.home === RULESET_HOME.SESSION) {
            // **A session character does not open a sheet.** Nothing can write to one yet —
            // spending points and moving a resource go through the server with a revision guard,
            // which is TICKET-PLY-01's — so a sheet here would be a page whose every control
            // silently lost what it changed.
            //
            // **And the browser's own ruleset goes back.** The Snapshot was opened *for the
            // wizard*; leaving it open would send the Player to `/config` looking at a game's copy
            // of the rules with nothing saying so, and every edit refused by a banner they would
            // have to read to find out why (v3 Req 36.8's *unambiguous at all times*).
            openLocalRuleset();
            navigate({ to: '/sessions' });
            return;
          }

          navigate({ to: '/play/character/$id', params: { id: result.created.id } });
        })
        .finally(() => setIsSubmitting(false));
    },
  };
}
