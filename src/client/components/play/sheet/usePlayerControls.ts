/**
 * The writes that belong to the character's own Player, for the reader who has them (TICKET-DM-05)
 *
 * Six handlers that `useSheetActions` used to carry, and they left it for the reason the purse pair
 * left it at TICKET-DM-02: each is a write whose **actor depends on who is reading the sheet**, which
 * is a different subject from *what the Player can do to it*. What stayed there — experience, the
 * dream level, the way off the page — is a write whose actor is not in question.
 *
 * Every one of the six meets a route behind `requireCharacterPlayer`, which is `requireCharacterWriter`
 * **minus the DM** (see [`guards.ts`](../../../../server/auth/guards.ts)). So a DM pressing any of them
 * gets a 404, and TICKET-DM-01 recorded the gap while leaving the controls visible *"so the gap is
 * obvious"*. This closes it: the DM gets no handlers, and each surface draws a display instead —
 * **absent, not present and disabled** (v3 Req 49.10). A Player keeps all six, on a local sheet and at
 * a table alike, because at a table they are still the character's own Player.
 *
 * ## Why the fields are optional rather than the object being `null`
 *
 * The four hooks that set this pattern — [`usePurseControls`](./usePurseControls.ts),
 * [`useInventoryActs`](../inventory/useInventoryActs.ts),
 * [`usePassiveHandout`](../passives/usePassiveHandout.ts) and
 * [`useQuickActions`](../dm/useQuickActions.ts) — each return `X | null`, and each feeds **one**
 * surface, where `null` is the whole answer. This one feeds **five**, and the precedent is being
 * *extended* here rather than broken:
 *
 * - **Optional fields let `useCharacterSheet` spread it** exactly where it already spreads
 *   `...actions`, so [`CharacterSheet.tsx`](./CharacterSheet.tsx) changes in **comments only**. The
 *   strict shape would cost a `controls?.x` at each of the sheet's seven handler props — a new
 *   conditional per prop, on a component `fallow` measured at 9.7 after this project's first recorded
 *   fall. That is the exact trade TICKET-DM-03 learned to refuse, and criterion 7 of this ticket is a
 *   check on it.
 * - **Absence is modelled as absence**, which is the same thing the five sections are being asked to
 *   render. A missing handler *is* the answer they draw a display for.
 *
 * So: not a correction waiting to happen. A hook feeding one surface should still answer `null`.
 *
 * ## The cost of all-optional fields, and what pays it
 *
 * A dropped or mistyped handler name compiles **silently to the DM's view** — nothing is missing from
 * an interface whose every member is optional. That risk is real and the mitigation is deliberate
 * rather than incidental: [`usePlayerControls.test.ts`](./usePlayerControls.test.ts)'s `HANDLERS` and
 * [`CharacterSheet.dmView.test.tsx`](./CharacterSheet.dmView.test.tsx)'s `SURFACES` **enumerate** the
 * six by name across three readers, so a name that stops arriving fails a case rather than quietly
 * hiding a control. Keep both tables in step with this interface; they are what make the shape safe.
 *
 * **Validates: v3 Req 41.1, 42.7, 49.10; Requirements 14.2, 14.3, 14.5**
 */

import { focusPicksOf, toFocusSlots } from '#shared/engine/focusSkills';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { useCharacterStore } from '../../../stores/characterStore';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';

/**
 * What the sheet's Player-owned controls call — **every field absent for the table's DM**
 *
 * Named as the sheet already named them, so the handlers reach the same props they always did.
 */
export interface PlayerControls {
  handleChangeStatValue?: (statId: string, value: number) => void;
  handleAdjustStatValue?: (statId: string, delta: number) => void;
  handleResetStatValueToMax?: (statId: string) => void;
  handleChangeInvestedPoints?: (statId: string, points: number) => void;
  handleChangeInvestedSkillPoints?: (skillId: string, points: number) => void;
  /** Put a skill in one focus slot — the store sends all three, see below (TICKET-SKL-05) */
  handleSelectFocusSkill?: (slot: number, skillId: string) => void;
}

/**
 * Bind the Player's own sheet controls, or answer that this reader has none
 *
 * @param characterId The id the route named — what the predicate is asked about
 * @param character The character the sheet is drawing, or null when there is none
 * @param config The ruleset it is read against — the browser's, or a table's Snapshot
 * @returns The six handlers, or an empty set for the table's DM
 */
export function usePlayerControls(
  characterId: string,
  character: Character | null,
  config: Configuration | null
): PlayerControls {
  const updateCurrentStatValue = useCharacterStore((state) => state.updateCurrentStatValue);
  const adjustCurrentStatValue = useCharacterStore((state) => state.adjustCurrentStatValue);
  const resetCurrentStatValueToMax = useCharacterStore((state) => state.resetCurrentStatValueToMax);
  const setInvestedStatPoints = useCharacterStore((state) => state.setInvestedStatPoints);
  const setInvestedSkillPoints = useCharacterStore((state) => state.setInvestedSkillPoints);
  const setFocusSkills = useCharacterStore((state) => state.setFocusSkills);

  // The predicate alone, and **only this hook's own six selectors** — the rule DM-02 arrived at after
  // a bundle of every actor's actions was rejected for subscribing each caller to writes it never makes
  const isDungeonMaster = useIsDungeonMaster(characterId);

  // Not a disabled control and not a no-op pair: the handlers are simply not there, and the sections
  // draw the numbers with no way to move them. There is no DM route for any of these six by design —
  // a DM who wants points spent differently has `dm-grant-points` (TICKET-DM-05's note)
  if (isDungeonMaster) return {};

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

    /**
     * Put a skill in one focus slot (TICKET-SKL-05)
     *
     * **Addressed by slot here and sent as a whole list**, which is the shape the two ends need: a
     * picker changes one box, and the character stores the picks that were made with no sentinel for
     * the ones that were not. The empties drop out on the way, so picks compact to the front — which
     * changes nothing, because the multiplier is a sum over the slots and does not read their order.
     *
     * The slots are rebuilt from the stored picks rather than from the component's own state, for
     * the reason every handler here takes the store's word: the character is the one copy, and a
     * refused write must leave the boxes showing what is actually stored.
     */
    handleSelectFocusSkill: (slot: number, skillId: string) => {
      if (!character || !config) return;

      const picks = focusPicksOf(character);
      const slots = toFocusSlots(picks);
      slots[slot] = skillId;

      const chosen = slots.filter((id) => id !== '');
      setFocusSkills(character.id, chosen, config);
    },
  };
}
