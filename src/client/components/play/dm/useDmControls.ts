/**
 * Binding the Dungeon Master's controls to the store (TICKET-DM-01)
 *
 * [`useSheetActions`](../sheet/useSheetActions.ts)'s counterpart for the other actor, and the same
 * shape: a guard against there being no character, and a call. Every rule — what a level costs, what
 * a revocation would leave overspent, where a pool may stand — is the Kernel's, checked on the
 * server, and nothing here does arithmetic.
 *
 * **Whether the reader *is* the DM is answered outside the component**, because it is a fact about
 * state and not about layout — [`useIsDungeonMaster`](./useIsDungeonMaster.ts), which TICKET-DM-02
 * extracted when a second hook came to need the same answer.
 *
 * ## What this hook is, and what it stopped being at TICKET-DM-02
 *
 * It is the DM's writes to what a character **is** — experience, the level it derives to, the points
 * they may spend, where their pools stand, how far they stand in their dream, the abilities they
 * hold. **The DM's writes to what a character *has* are not here**, and are not in a second bundle
 * either: `dm-set-purse`/`dm-adjust-purse` are reached by
 * [`usePurseControls`](../sheet/usePurseControls.ts) and the four pack acts by
 * [`useInventoryActs`](../inventory/useInventoryActs.ts), each subscribing to its own selectors and
 * nothing more. DM-02 put all fourteen handlers here first and `fallow` measured this hook over the
 * cognitive threshold for it (19 against 15, on an intermediate state that is not in the tree — the
 * shipped hook reads **10 cognitive across 10 hooks**). The first fix was a second *bundle* holding
 * the other six, and the review rejected it: **no caller wanted both halves**, so `usePurseControls`
 * would have subscribed to four writes it never makes and `useInventoryActs` to two. The rule that
 * survived is the simpler one — **a surface takes the actions it uses**, and what the three of them
 * genuinely share is one predicate, {@link useIsDungeonMaster}.
 *
 * **Validates: v3 Req 42.1, 42.2, 42.3, 42.5, 42.7**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useIsDungeonMaster } from './useIsDungeonMaster';

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
  /**
   * Hand this character a passive ability, and take one back (TICKET-PAS-01)
   *
   * Here rather than in `useSheetActions` because at a table these are the **only** doors: there is
   * no player route to `Character.passiveIds`, so a Player asking is refused by the server rather
   * than merely undrawn. The sheet hands this pair to `PassivesPanel` when the reader is the DM and
   * the Player's own pair when the character is local.
   */
  handleGrantPassive: (passiveId: string) => void;
  handleRevokePassive: (passiveId: string) => void;
}

/**
 * Bind the DM's controls for one character
 *
 * @param characterId The id the route named
 * @returns One handler per control, and whether to draw them
 */
export function useDmControls(characterId: string): DmControls {
  const isDungeonMaster = useIsDungeonMaster(characterId);
  const isBusy = useCharacterStore((state) => state.isActing);

  const dmAwardExperience = useCharacterStore((state) => state.dmAwardExperience);
  const dmDeductExperience = useCharacterStore((state) => state.dmDeductExperience);
  const dmSetLevel = useCharacterStore((state) => state.dmSetLevel);
  const dmSetGrantedPoints = useCharacterStore((state) => state.dmSetGrantedPoints);
  const dmSetResource = useCharacterStore((state) => state.dmSetResource);
  const dmSetDreamLevel = useCharacterStore((state) => state.dmSetDreamLevel);
  const dmGrantPassive = useCharacterStore((state) => state.dmGrantPassive);
  const dmRevokePassive = useCharacterStore((state) => state.dmRevokePassive);

  return {
    isDungeonMaster,
    isBusy,

    handleAwardExperience: (amount: number) => dmAwardExperience(characterId, amount),
    handleDeductExperience: (amount: number) => dmDeductExperience(characterId, amount),
    handleSetLevel: (level: number) => dmSetLevel(characterId, level),
    handleSetGrantedPoints: (points: number) => dmSetGrantedPoints(characterId, points),
    handleSetResource: (statId: string, value: number) => dmSetResource(characterId, statId, value),
    handleSetDreamLevel: (level: number) => dmSetDreamLevel(characterId, level),
    handleGrantPassive: (passiveId: string) => dmGrantPassive(characterId, passiveId),
    handleRevokePassive: (passiveId: string) => dmRevokePassive(characterId, passiveId),
  };
}
