/**
 * Binding the Dungeon Master's controls to the store (TICKET-DM-01)
 *
 * [`useSheetActions`](../sheet/useSheetActions.ts)'s counterpart for the other actor, and the same
 * shape: a guard against there being no character, and a call. Every rule — what a level costs, what
 * a revocation would leave overspent, where a pool may stand — is the Kernel's, checked on the
 * server, and nothing here does arithmetic.
 *
 * **Whether the reader *is* the DM is answered here rather than in the component**, because it is a
 * fact about state and not about layout. It is a comparison rather than a request: the server opens
 * a character to its owner or to the DM of its table, so a table character that is not the reader's
 * own has exactly one possible reader.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.5, 42.7**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';

/** What the DM panel calls, plus whether there is a DM panel to draw at all */
export interface DmControls {
  /** True when the open sheet belongs to somebody else at a table the reader runs */
  isDungeonMaster: boolean;
  /** True while an adjustment is on the wire */
  isBusy: boolean;
  handleAwardExperience: (amount: number) => void;
  handleDeductExperience: (amount: number) => void;
  handleSetLevel: (level: number) => void;
  handleSetGrantedPoints: (points: number) => void;
  handleSetResource: (statId: string, value: number) => void;
  /** Set how far the character stands in their dream — the DM's action (TICKET-RES-04) */
  handleSetDreamLevel: (level: number) => void;
}

/**
 * Bind the DM's controls for one character
 *
 * @param characterId The id the route named
 * @returns One handler per control, and whether to draw them
 */
export function useDmControls(characterId: string): DmControls {
  const { accountId } = useAuth();

  const isAtTable = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const ownerAccountId = useCharacterStore((state) => state.tableCharacterOwnerId);
  const isBusy = useCharacterStore((state) => state.isActing);

  const dmAwardExperience = useCharacterStore((state) => state.dmAwardExperience);
  const dmDeductExperience = useCharacterStore((state) => state.dmDeductExperience);
  const dmSetLevel = useCharacterStore((state) => state.dmSetLevel);
  const dmSetGrantedPoints = useCharacterStore((state) => state.dmSetGrantedPoints);
  const dmSetResource = useCharacterStore((state) => state.dmSetResource);
  const dmSetDreamLevel = useCharacterStore((state) => state.dmSetDreamLevel);

  return {
    // `accountId === null` is a browser that has not resolved its cookie yet, and answering *yes*
    // there would flash the DM's panel onto a Player's own sheet for a frame
    isDungeonMaster:
      isAtTable && accountId !== null && ownerAccountId !== null && ownerAccountId !== accountId,
    isBusy,

    handleAwardExperience: (amount: number) => dmAwardExperience(characterId, amount),
    handleDeductExperience: (amount: number) => dmDeductExperience(characterId, amount),
    handleSetLevel: (level: number) => dmSetLevel(characterId, level),
    handleSetGrantedPoints: (points: number) => dmSetGrantedPoints(characterId, points),
    handleSetResource: (statId: string, value: number) => dmSetResource(characterId, statId, value),
    handleSetDreamLevel: (level: number) => dmSetDreamLevel(characterId, level),
  };
}
