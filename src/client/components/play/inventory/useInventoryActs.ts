/**
 * Who may move this character's kit, and through which actions (TICKET-DM-02)
 *
 * [`usePassiveHandout`](../passives/usePassiveHandout.ts)'s shape one collection over, and for its
 * reason: there are genuinely two actors, they reach different store actions with different guards
 * behind them, and *deciding who may act* is a different subject from *laying the pack out*.
 *
 * - **A Player moves their own kit**, on a local sheet and at a table alike. That is the whole of
 *   what `routes/play/`'s four inventory routes are for, and TICKET-DM-02 changed none of it.
 * - **A DM moves somebody else's**, through the four `dm-` routes this ticket added — which run the
 *   *identical* Kernel functions. A DM equipping a helmet into a boot slot is refused in the Player's
 *   own sentence, because it is the Player's own rule (Requirement 12.3).
 *
 * ## Why this is not `usePassiveHandout`'s exact copy
 *
 * That hook returns `null` for a Player at a table, because there is no player route to a passive at
 * all. Here there is: the four acts are a Player's own, and a Player at a table keeps every one of
 * them. So the only reader who gets nothing is one with no ruleset loaded to act against — the DM's
 * half needs none, since the server runs the rule against the Snapshot (D5).
 *
 * **Nothing under `InventoryPanel` learns which actor it is drawing for.** That is the point of
 * putting the decision here rather than threading an optional handler down through the panel, the
 * doll, the slot tile and the builder — DM-01's note about what that costs, avoided rather than paid.
 *
 * **Validates: v3 Req 42.5, 42.7; Requirements 12.2, 12.3, 12.5, 12.6**
 */

import type { ComposedItem } from '#shared/types/character';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';

/** The four acts a build has a life through, bound to whichever actor is asking */
export interface InventoryActs {
  equip: (equipmentSlotType: string, composedId: string) => void;
  unequip: (equipmentSlotType: string) => void;
  build: (build: Omit<ComposedItem, 'id'>) => void;
  discard: (composedId: string) => void;
}

/**
 * Bind the four inventory acts for one character
 *
 * @param characterId The id the sheet is drawing
 * @returns The four, or `null` when there is no ruleset for a Player's own write to be checked against
 */
export function useInventoryActs(characterId: string): InventoryActs | null {
  // Read here rather than taken as a prop, `usePassiveHandout`'s arrangement: the Player's own store
  // actions price their rules against a ruleset, and threading one through the panel for that would
  // put a `Configuration` in the sheet's props for the sake of a hook three levels down
  const config = useConfigStore((state) => state.config);

  const equipItem = useCharacterStore((state) => state.equipItem);
  const unequipItem = useCharacterStore((state) => state.unequipItem);
  const buildItem = useCharacterStore((state) => state.buildItem);
  const discardItem = useCharacterStore((state) => state.discardItem);

  const dmEquipItem = useCharacterStore((state) => state.dmEquipItem);
  const dmUnequipItem = useCharacterStore((state) => state.dmUnequipItem);
  const dmBuildItem = useCharacterStore((state) => state.dmBuildItem);
  const dmDiscardItem = useCharacterStore((state) => state.dmDiscardItem);

  // The predicate alone, and **only this hook's own eight selectors** — the purse pair is
  // `usePurseControls`' business and no caller of either wants both halves
  const isDungeonMaster = useIsDungeonMaster(characterId);

  if (isDungeonMaster) {
    // None of the four takes a `Configuration`: the server runs the rule against the **Snapshot**
    // and hands the answer back (D5), so a client-side ruleset would be a second opinion nobody
    // reads — and, on a stale one, a wrong one
    return {
      equip: (equipmentSlotType: string, composedId: string) =>
        dmEquipItem(characterId, equipmentSlotType, composedId),
      unequip: (equipmentSlotType: string) => dmUnequipItem(characterId, equipmentSlotType),
      build: (draft: Omit<ComposedItem, 'id'>) => dmBuildItem(characterId, draft),
      discard: (composedId: string) => dmDiscardItem(characterId, composedId),
    };
  }

  if (config === null) return null;

  return {
    equip: (equipmentSlotType: string, composedId: string) =>
      equipItem(characterId, equipmentSlotType, composedId, config),
    unequip: (equipmentSlotType: string) => unequipItem(characterId, equipmentSlotType),
    build: (draft: Omit<ComposedItem, 'id'>) => buildItem(characterId, draft, config),
    discard: (composedId: string) => discardItem(characterId, composedId, config),
  };
}
