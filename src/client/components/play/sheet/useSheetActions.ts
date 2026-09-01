/**
 * Every write the character sheet can make, and the way off it (TICKET-PLY-01)
 *
 * **Split out of `useCharacterSheet` because that hook grew a second destination**, which is the
 * same reason and the same shape as `useCharacterSubmit` coming out of `useCharacterCreation` in
 * TICKET-CHAR-04. The half that stayed is *what the sheet shows* — the engine result, the
 * breakdowns, the budget; the half that came here is *what the Player can do to it*, and the two
 * have nothing in common but the character they are about.
 *
 * The store owns every rule and every destination: an action here is a guard against there being no
 * character, and a call. Where the write actually goes — LocalStorage or a table's server — is
 * `characterStore`'s one branch, and nothing on this side knows which it was.
 *
 * **The purse pair left for [`usePurseControls`](./usePurseControls.ts) at TICKET-DM-02.** Everything
 * still here is a write the Player makes with no question about whether they may; the purse became a
 * write whose *actor* depends on the reader, which is `usePassiveHandout`'s subject and not this
 * hook's. Two handlers out is why this file got shorter in a ticket that added a feature.
 *
 * **Six more left for [`usePlayerControls`](./usePlayerControls.ts) at TICKET-DM-05**, on the same
 * grounds and the same reading: the stat and skill spends, the three pool writes and the focus pick
 * are all behind `requireCharacterPlayer`, so *may this reader make this write* has an answer that
 * depends on who is holding the sheet open. What is left here is the residue that has no such
 * question — experience and the dream level, which the sheet already withholds at a table for
 * **every** reader (D9), and the way off the page, which is nobody's write at all.
 *
 * **Validates: v3 Req 41.1, 41.5**
 *
 * (No v1.0 requirement is cited any more: the four handlers left here are experience, the dream level
 * and the way off the page, all of which are v3's. The old header's `12.5` and `14.5` travelled with
 * the handlers that implement them — to `useInventoryActs` and `usePlayerControls` — and carrying a
 * number onto a module that no longer earns it would be worse than citing none, because traceability
 * is checked by grep and a wrong citation reads exactly like a right one.)
 */

import { useNavigate } from '@tanstack/react-router';
import type { Character } from '#shared/types/character';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/** What the sheet's controls call */
export interface SheetActions {
  handleAwardExperience: (amount: number) => void;
  handleDeductExperience: (amount: number) => void;
  handleSetDreamLevel: (level: number) => void;
  handleBack: () => void;
}

/**
 * Bind the sheet's controls to the store
 *
 * **No `Configuration` since TICKET-DM-05**: every handler that had to price a write against the
 * ruleset went to `usePlayerControls` with the rest of the reader-dependent six, and what is left
 * writes a number the Kernel checks on its own side.
 *
 * @param character The character the sheet is drawing, or null when there is none
 * @param atTable Whether this character lives at a game session
 * @returns One handler per control
 */
export function useSheetActions(character: Character | null, atTable: boolean): SheetActions {
  const navigate = useNavigate();

  const awardExperience = useCharacterStore((state) => state.awardExperience);
  const deductExperience = useCharacterStore((state) => state.deductExperience);
  const updateDreamLevel = useCharacterStore((state) => state.updateDreamLevel);
  const closeTableCharacter = useCharacterStore((state) => state.closeTableCharacter);
  const openLocalRuleset = useConfigStore((state) => state.openLocalRuleset);

  return {
    // One action per click, mirroring the sheet's `exp.gs` — the store decides what is allowed
    handleAwardExperience: (amount: number) => {
      if (!character) return;

      awardExperience(character.id, amount);
    },

    handleDeductExperience: (amount: number) => {
      if (!character) return;

      deductExperience(character.id, amount);
    },

    // The whole number the Player typed, sent as typed: whether a dream level is allowed is the
    // Kernel's answer, and at a table it is the DM's to set rather than this one's (TICKET-RES-04)
    handleSetDreamLevel: (level: number) => {
      if (!character) return;

      updateDreamLevel(character.id, level);
    },

    /**
     * Leave the sheet (TICKET-PLY-01)
     *
     * A character at a table came from the game it plays at, and that is where *back* means —
     * `/play` lists the browser's own characters and would not have this one in it. **The browser's
     * ruleset goes back with it**, for `useCharacterSubmit`'s reason: the Snapshot was opened *for
     * this sheet*, and leaving it open would send the Player to `/config` looking at a game's copy
     * of the rules with nothing saying so (v3 Req 36.8).
     */
    handleBack: () => {
      if (atTable) {
        closeTableCharacter();
        openLocalRuleset();
        navigate({ to: '/sessions' });
        return;
      }

      navigate({ to: '/play' });
    },
  };
}
