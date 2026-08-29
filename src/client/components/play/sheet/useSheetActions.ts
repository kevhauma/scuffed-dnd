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
 * **Validates: Requirements 12.5, 14.2, 14.3, 14.5; v3 Req 41.1, 41.5**
 */

import { useNavigate } from '@tanstack/react-router';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/** What the sheet's controls call */
export interface SheetActions {
  handleChangeStatValue: (statId: string, value: number) => void;
  handleAdjustStatValue: (statId: string, delta: number) => void;
  handleResetStatValueToMax: (statId: string) => void;
  handleChangeInvestedPoints: (statId: string, points: number) => void;
  handleChangeInvestedSkillPoints: (skillId: string, points: number) => void;
  handleSetPurse: (amount: number) => void;
  handleAdjustPurse: (delta: number) => void;
  handleAwardExperience: (amount: number) => void;
  handleDeductExperience: (amount: number) => void;
  handleSetDreamLevel: (level: number) => void;
  handleBack: () => void;
}

/**
 * Bind the sheet's controls to the store
 *
 * @param character The character the sheet is drawing, or null when there is none
 * @param config The ruleset it is read against — the browser's, or a table's Snapshot
 * @param atTable Whether this character lives at a game session
 * @returns One handler per control
 */
export function useSheetActions(
  character: Character | null,
  config: Configuration | null,
  atTable: boolean
): SheetActions {
  const navigate = useNavigate();

  const updateCurrentStatValue = useCharacterStore((state) => state.updateCurrentStatValue);
  const adjustCurrentStatValue = useCharacterStore((state) => state.adjustCurrentStatValue);
  const resetCurrentStatValueToMax = useCharacterStore((state) => state.resetCurrentStatValueToMax);
  const setInvestedStatPoints = useCharacterStore((state) => state.setInvestedStatPoints);
  const setInvestedSkillPoints = useCharacterStore((state) => state.setInvestedSkillPoints);
  const setPurse = useCharacterStore((state) => state.setPurse);
  const adjustPurse = useCharacterStore((state) => state.adjustPurse);
  const awardExperience = useCharacterStore((state) => state.awardExperience);
  const deductExperience = useCharacterStore((state) => state.deductExperience);
  const updateDreamLevel = useCharacterStore((state) => state.updateDreamLevel);
  const closeTableCharacter = useCharacterStore((state) => state.closeTableCharacter);
  const openLocalRuleset = useConfigStore((state) => state.openLocalRuleset);

  return {
    handleChangeStatValue: (statId: string, value: number) => {
      if (!character || !config) return;

      // Persistence — and the max-value clamp — belong to the store action, not to this hook
      updateCurrentStatValue(character.id, statId, value, config);
    },

    // Concept 20's quick entry and "regain to full" (TICKET-RES-03). The delta is applied and the
    // maximum is read inside the store, so nothing here does arithmetic on a pool.
    handleAdjustStatValue: (statId: string, delta: number) => {
      if (!character || !config) return;

      adjustCurrentStatValue(character.id, statId, delta, config);
    },

    handleResetStatValueToMax: (statId: string) => {
      if (!character || !config) return;

      resetCurrentStatValueToMax(character.id, statId, config);
    },

    // Spending is the level-up mechanic (TICKET-RES-02). The store refuses anything the derived
    // budget cannot pay for, so the sheet asks and renders whatever came back.
    handleChangeInvestedPoints: (statId: string, points: number) => {
      if (!character || !config) return;

      setInvestedStatPoints(character.id, statId, points, config);
    },

    // The same pool as the stats above, since TICKET-RES-05 — so the same ruleset goes in, and the
    // store refuses whatever the derived budget cannot pay for
    handleChangeInvestedSkillPoints: (skillId: string, points: number) => {
      if (!character || !config) return;

      setInvestedSkillPoints(character.id, skillId, points, config);
    },

    // Set and adjust are two intents rather than one plus arithmetic here: `-12` against a purse
    // means *spend twelve*, and the store is where "and refuse if that goes below zero" lives
    handleSetPurse: (amount: number) => {
      if (!character) return;

      setPurse(character.id, amount);
    },

    handleAdjustPurse: (delta: number) => {
      if (!character) return;

      adjustPurse(character.id, delta);
    },

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
