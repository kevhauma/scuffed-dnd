/**
 * Who may hand this character a passive, and through which actions (TICKET-PAS-01)
 *
 * The one place *which actor is asking* is decided, because there are genuinely two and they reach
 * different store actions with different guards behind them:
 *
 * - **On a local sheet the Player writes it themselves.** Signed out there is no DM, and the person
 *   keeping their own sheet plays both parts — experience's and the dream level's established split.
 * - **At a table only the DM can.** There is no player route to `Character.passiveIds` at all, so a
 *   Player asking is refused by the server rather than merely undrawn, and a Player *at* a table gets
 *   no handlers here.
 *
 * ## Why it is a hook of its own rather than two lines in the sheet
 *
 * It started as two lines in the sheet: a `!atTable || isDungeonMaster` and a ternary picking the
 * pair. `fallow` measured `CharacterSheet` past the complexity threshold on that diff and
 * `useSheetActions` with it, which was the honest reading — *laying a sheet out* and *deciding who
 * may act on it* are two subjects, and the second was spread across three files. `useSheetActions`
 * carries the Player's own writes for every other field, `useDmControls` carries the DM's, and this
 * is the one module that knows the answer depends on the reader. `SheetStatusNotice`'s extraction at
 * TICKET-DM-01 for the same measurement and the same reason.
 *
 * **Returning `null` rather than a pair of no-ops is the point.** The panel draws no control at all
 * for a reader who may not act, because an absent control says *not yours* where a disabled one says
 * *not now* — the sheet's own treatment of the purse and the experience controls at a table.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useDmControls } from '../dm/useDmControls';

/** The pair a reader who may change what is held gets, in the panel's own words */
export interface PassiveHandout {
  grant: (passiveId: string) => void;
  revoke: (passiveId: string) => void;
}

/**
 * Bind the passive handout for one character, or answer that this reader has none
 *
 * @param characterId The id the route named
 * @param atTable Whether the open character plays at a game session
 * @returns The pair to hand the panel, or `null` for a reader who may not act
 */
export function usePassiveHandout(characterId: string, atTable: boolean): PassiveHandout | null {
  // Read here rather than taken as a prop, `usePassives`' arrangement: the grant rule checks the
  // catalog, and threading a ruleset through the panel for one call would put a `Configuration` in
  // the sheet's props for the sake of a hook two levels down
  const config = useConfigStore((state) => state.config);

  const grantPassive = useCharacterStore((state) => state.grantPassive);
  const revokePassive = useCharacterStore((state) => state.revokePassive);

  const dm = useDmControls(characterId);

  if (dm.isDungeonMaster) {
    return { grant: dm.handleGrantPassive, revoke: dm.handleRevokePassive };
  }

  // A Player at a table is shown the list and no controls — the handout is the DM's, and the store
  // refuses this pair there anyway, which is what keeps the rule out of a JSX conditional
  if (atTable || config === null) return null;

  return {
    grant: (passiveId: string) => grantPassive(characterId, passiveId, config),
    revoke: (passiveId: string) => revokePassive(characterId, passiveId),
  };
}
