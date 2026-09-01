/**
 * Who may change this character's money (TICKET-DM-02)
 *
 * [`usePassiveHandout`](../passives/usePassiveHandout.ts)'s shape one field over, and the same three
 * readers with the same three answers:
 *
 * - **On a local sheet the Player keeps their own purse.** Signed out there is no DM and one person
 *   plays both parts — experience's and the dream level's established split.
 * - **At a table only the DM may write it** (v3 Req 42.5). There is no player route to a purse at
 *   all, so a Player asking is refused by the store rather than merely undrawn.
 * - **A Player at a table gets `null`**, and the card they are shown is the amount with no entry box.
 *
 * ## Why a Player at a table still sees the card
 *
 * Because *"the payment lands on the sheet instead of in a note"* — the user story — is not satisfied
 * by a number the Player cannot see. Until this ticket the purse was absent at a table entirely,
 * which was right while nobody could change it and wrong the moment the DM could.
 *
 * **A read-only card is not the thing criterion 6 rejects.** That rejects a present-and-disabled
 * *control*, which tells a Player a power exists and invites them to ask for it. An amount with no
 * box beside it is a *display*, and it is the same optional-handler shape `SheetHeader` already uses
 * for the experience controls it withholds at a table.
 *
 * **Validates: v3 Req 42.5, 42.7, 43.1, 43.2, 43.4**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';

/** The pair a reader who may change the money gets, in the purse card's own words */
export interface PurseControls {
  set: (amount: number) => void;
  adjust: (delta: number) => void;
}

/**
 * Bind the purse controls for one character, or answer that this reader has none
 *
 * @param characterId The id the route named
 * @param atTable Whether the open character plays at a game session
 * @returns The pair to hand the card, or `null` for a reader who may only read the amount
 */
export function usePurseControls(characterId: string, atTable: boolean): PurseControls | null {
  const setPurse = useCharacterStore((state) => state.setPurse);
  const adjustPurse = useCharacterStore((state) => state.adjustPurse);
  const dmSetPurse = useCharacterStore((state) => state.dmSetPurse);
  const dmAdjustPurse = useCharacterStore((state) => state.dmAdjustPurse);

  // The predicate alone, and **only this hook's own four selectors**. Reaching the DM's pair through
  // a bundle of every DM action would subscribe this hook to four writes it never makes, which is
  // the defect that split them off `useDmControls` in the first place, one size down.
  const isDungeonMaster = useIsDungeonMaster(characterId);

  if (isDungeonMaster) {
    return {
      set: (amount: number) => dmSetPurse(characterId, amount),
      adjust: (delta: number) => dmAdjustPurse(characterId, delta),
    };
  }

  // A Player at a table reads their purse and does not write it — the store refuses this pair there
  // anyway, which is what keeps the rule out of a JSX conditional
  if (atTable) return null;

  return {
    set: (amount: number) => setPurse(characterId, amount),
    adjust: (delta: number) => adjustPurse(characterId, delta),
  };
}
