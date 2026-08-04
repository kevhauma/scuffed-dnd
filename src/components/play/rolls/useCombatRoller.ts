/**
 * Combat Roller Hook
 *
 * Turns a roll request into a `CombatRollResult` from the dice engine, keeps the latest result per
 * skill for display, and records every roll in the session history.
 *
 * No dice are simulated and no formula is evaluated here — `rollCombatSkill` owns both, which is
 * what keeps a roll's bonus identical to the bonus the sheet shows.
 *
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.5, 5.5, 5.6**
 */

import { useState } from 'react';
import { rollCombatSkill } from '../../../engine/dice/combatRoll';
import type { RandomSource } from '../../../engine/dice/diceSimulator';
import { describeFormulaError, isFormulaError } from '../../../engine/formula/errors';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import type { CalculatedCharacter } from '../../../types/character';
import type { CombatRollResult } from '../../../types/formula';

export interface UseCombatRollerOptions {
  /**
   * Randomness for the roll, defaulting to the engine's `Math.random`.
   *
   * The seam exists so tests can assert exact numbers; production passes nothing.
   */
  rng?: RandomSource;
}

export function useCombatRoller(
  characterId: string,
  calculated: CalculatedCharacter | null,
  { rng }: UseCombatRollerOptions = {}
) {
  const config = useConfigStore((state) => state.config);
  const rollHistory = useUIStore((state) => state.rollHistory);
  const addRollResult = useUIStore((state) => state.addRollResult);
  const clearRollHistory = useUIStore((state) => state.clearRollHistory);

  /** Latest result per skill code — what the sheet shows beside the button */
  const [results, setResults] = useState<Record<string, CombatRollResult>>({});

  /** A skill whose bonus formula does not evaluate: reported beside that skill, not fatally */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRoll = (skillCode: string) => {
    if (!config || !calculated) return;

    const skill = config.combatSkills.find((candidate) => candidate.code === skillCode);
    if (!skill) return;

    try {
      const result = rollCombatSkill(skill, calculated, config, rng);

      // A bonus formula that does not evaluate comes back as an error value (TICKET-FORM-05):
      // reported beside this skill, with no result and no history entry.
      if (isFormulaError(result)) {
        setErrors((current) => ({ ...current, [skillCode]: describeFormulaError(result) }));
        return;
      }

      setResults((current) => ({ ...current, [skillCode]: result }));
      // A successful roll clears any error standing against that skill
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([code]) => code !== skillCode))
      );

      // Session history belongs to the UI store; it is deliberately never persisted
      addRollResult({
        ...result,
        id: crypto.randomUUID(),
        characterId,
        characterName: calculated.name,
      });
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [skillCode]: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  return {
    results,
    errors,
    /** This character's rolls, newest first — the store already prepends */
    history: rollHistory.filter((roll) => roll.characterId === characterId),
    canRoll: config !== null && calculated !== null,
    handleRoll,
    handleClearHistory: clearRollHistory,
  };
}
