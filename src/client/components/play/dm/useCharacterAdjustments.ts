/**
 * What the DM has changed on one sheet (TICKET-DM-01, v3 Req 42.7)
 *
 * The Player-facing half of the requirement: *the Client SHALL present DM controls only to the DM,
 * and SHALL show a Player the Events that changed their own sheet*. Without it, somebody who was
 * awarded 300 experience between two page loads sees a level that moved and nothing saying why.
 *
 * **Its own hook rather than [`useSessionResource`](../../sessions/useSessionResource.ts)**, which is
 * the near neighbour and the thing to reach for first. It is keyed on the *open table* and re-reads
 * when that id changes; this has to re-read when the **character** changes while its id stays the
 * same, because every adjustment is a new row in the list it is showing. `stamp` is what that costs:
 * one string, the sheet's `updatedAt`, which moves on every accepted write from either actor.
 *
 * **The stamp is also the staleness guard, which is why it is a version rather than a trigger.** A
 * request cannot be cancelled, so two reads can land out of order — after an adjustment, that means
 * the *pre*-adjustment list arriving last and the panel showing a history one entry short of the
 * number beside it. Comparing what a read was about against what the panel is now showing drops it,
 * and the same comparison covers opening one sheet and then another.
 *
 * **A refusal is silent.** The log is context beside a sheet, not the sheet — a red banner because a
 * *history* could not be fetched would be louder than what it is about. An empty list reads as
 * *nothing has happened here*, which is also what an unreachable server means for this panel.
 *
 * **Validates: v3 Req 42.6, 42.7**
 */

import { useEffect, useRef, useState } from 'react';
import type { CharacterAdjustment } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import { fetchCharacterAdjustments } from '../../../services/characterSync';

/**
 * Read one character's adjustment history, re-reading whenever the sheet changes
 *
 * **Takes the character rather than an id and a stamp**, which is the honest signature: its subject
 * is *this sheet, as it now stands*, and both halves of that come off the same object. It also keeps
 * the three null checks out of `CharacterSheet`, which `fallow` measures and which has no opinion
 * about them.
 *
 * @param character The sheet being drawn, or `null` when there is none
 * @param atTable Whether it lives at a game session — a local character has no Event log to project
 * @returns The adjustments, newest first; empty until the first read lands
 */
export function useCharacterAdjustments(
  character: Character | null,
  atTable: boolean
): CharacterAdjustment[] {
  const characterId = atTable && character ? character.id : null;
  const stamp = character?.updatedAt ?? null;

  const [adjustments, setAdjustments] = useState<CharacterAdjustment[]>([]);

  /** Which character, at which version of it, the panel is actually showing */
  const showing = useRef('');

  useEffect(() => {
    if (characterId === null) {
      showing.current = '';
      setAdjustments([]);
      return;
    }

    const version = `${characterId}@${stamp ?? ''}`;
    showing.current = version;

    void fetchCharacterAdjustments(characterId)
      .then((listing) => {
        if (showing.current === version) setAdjustments(listing.adjustments);
      })
      .catch(() => {
        // Deliberately silent — see the module note
      });
  }, [characterId, stamp]);

  return adjustments;
}
