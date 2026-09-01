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
 * actions and nothing else. **There are seven readers now**: those three, plus TICKET-DM-03's
 * [`useQuickActions`](./useQuickActions.ts) and TICKET-DM-05's
 * [`usePlayerControls`](../sheet/usePlayerControls.ts), [`useRoller`](../rolls/useRoller.ts) and
 * [`useSpellbook`](../spells/useSpellbook.ts). Computing it seven times is how they would eventually
 * disagree about who is looking at the sheet — which is the whole reason it is a hook rather than a
 * field on any one of them. **Keep this count honest**: it is the first thing a reader opening this
 * module learns, and `.claude/skills/project-map/SKILL.md` states it too.
 *
 * **The last three read it in the opposite direction from the first four.** DM-01 through DM-03 ask
 * *may I show the DM their controls*; DM-05 asks *may I show the Player theirs*, and answers no for
 * the DM. One predicate, both readings — which is why the *says no while the cookie is unresolved*
 * rule below is the safe default in both: an unidentified browser draws the Player's own sheet.
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
