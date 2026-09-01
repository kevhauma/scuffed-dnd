/**
 * Whether the reader runs the table this character sits at (TICKET-DM-01, extracted by DM-02)
 *
 * **A comparison rather than a request.** The server opens a character to its owner **or** to the DM
 * of its table and nobody else, so *at a table and not mine* has exactly one possible reader. That
 * deduction is sound only because of the server's rule, which is why it is written down here rather
 * than inferred at three call sites.
 *
 * It lived inside `useDmControls` until TICKET-DM-02, when two more surfaces came to need the same
 * answer — [`usePurseControls`](../sheet/usePurseControls.ts) and
 * [`useInventoryActs`](../inventory/useInventoryActs.ts), each of which reaches its **own** DM store
 * actions and nothing else. Three readers of one predicate, and computing it three times is how they
 * would eventually disagree about who is looking at the sheet.
 *
 * **It says no while the cookie is unresolved**, and that is load-bearing: answering *yes* on a
 * browser that has not identified itself yet would flash the DM's controls onto a Player's own sheet
 * for a frame.
 *
 * **Validates: v3 Req 42.7**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useAuth } from '../../auth/useAuth';

/**
 * Answer whether this reader is the DM of the open character's table
 *
 * @param characterId The id the sheet is drawing
 * @returns True when the open sheet belongs to somebody else at a table the reader runs
 */
export function useIsDungeonMaster(characterId: string): boolean {
  const { accountId } = useAuth();

  const isAtTable = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const ownerAccountId = useCharacterStore((state) => state.tableCharacterOwnerId);

  return isAtTable && accountId !== null && ownerAccountId !== null && ownerAccountId !== accountId;
}
