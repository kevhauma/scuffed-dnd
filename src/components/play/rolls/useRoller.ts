/**
 * Roller Hook
 *
 * Turns a roll request into a `RollOutcome` from the dice engine, keeps the latest result per roll
 * for display, and records every roll in the session history.
 *
 * No dice are simulated and no formula is evaluated here — `rollRollDefinition` owns the first and
 * `calculateCharacter` the second, which is what keeps a roll's pool identical to the pool the
 * sheet's button showed.
 *
 * Replaces `useCombatRoller` (TICKET-ROLL-06); keyed by roll **id** rather than a 3-letter code,
 * since a roll definition has none.
 *
 * **Validates: Concept 08; Requirements 15.1, 15.2, 15.3, 15.5**
 */

import { useState } from 'react';
import type { RandomSource } from '../../../engine/dice/diceSimulator';
import { rollRollDefinition } from '../../../engine/dice/rollDefinition';
import { describeFormulaError, isFormulaError } from '../../../engine/formula/errors';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import type { CalculatedCharacter } from '../../../types/character';
import type { RollOutcome } from '../../../types/formula';

export interface UseRollerOptions {
  /**
   * Randomness for the roll, defaulting to the engine's `Math.random`.
   *
   * The seam exists so tests can assert exact numbers; production passes nothing.
   */
  rng?: RandomSource;
}

export function useRoller(
  characterId: string,
  calculated: CalculatedCharacter | null,
  { rng }: UseRollerOptions = {}
) {
  const config = useConfigStore((state) => state.config);
  const rollHistory = useUIStore((state) => state.rollHistory);
  const addRollResult = useUIStore((state) => state.addRollResult);
  const clearRollHistory = useUIStore((state) => state.clearRollHistory);

  /** Latest result per roll id — what the sheet shows beside the button */
  const [results, setResults] = useState<Record<string, RollOutcome>>({});

  /** A roll whose input does not evaluate: reported beside that roll, not fatally */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRoll = (rollId: string) => {
    if (!config || !calculated) return;

    const roll = (config.rollDefinitions ?? []).find((candidate) => candidate.id === rollId);
    if (!roll) return;

    try {
      const result = rollRollDefinition(roll, calculated, config, rng);

      // An input that does not evaluate comes back as an error value (TICKET-FORM-05): reported
      // beside this roll, with no result and no history entry.
      if (isFormulaError(result)) {
        setErrors((current) => ({ ...current, [rollId]: describeFormulaError(result) }));
        return;
      }

      setResults((current) => ({ ...current, [rollId]: result }));
      // A successful roll clears any error standing against that roll
      setErrors((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== rollId))
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
        [rollId]: error instanceof Error ? error.message : String(error),
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
    /** Forgets **this** character's rolls only — the button sits under a list scoped the same way */
    handleClearHistory: () => clearRollHistory(characterId),
  };
}
