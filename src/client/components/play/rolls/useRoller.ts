/**
 * Roller Hook
 *
 * Turns a roll request into a `RollOutcome`, keeps the latest result per roll for display, and
 * exposes the history the sheet lists beneath it.
 *
 * No dice are simulated and no formula is evaluated here — `rollRollDefinition` owns the first and
 * `calculateCharacter` the second, which is what keeps a roll's pool identical to the pool the
 * sheet's button showed.
 *
 * ## Two homes, and the dice are in different hands (TICKET-ROLL-07)
 *
 * **A local character still rolls locally** ([D6](../../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)),
 * through the engine and `useUIStore`'s in-memory history, exactly as before: there is nobody to
 * disagree with and no server to ask, and gating solo rolling behind an account would be the one
 * place this milestone made the app worse.
 *
 * **A character at a table does not roll at all — it asks.** Not even as a preview: a previewed roll
 * that differed from the recorded one is the exact failure v3 Req 45.2 exists to prevent. The button
 * keeps showing the *pool*, which is derived rather than random, and that is the whole label. What
 * comes back is the server's outcome, and the history is a projection of the session's Event log —
 * so it survives a reload, which `useUIStore`'s never could.
 *
 * ## And the table's DM does not roll either (TICKET-DM-05)
 *
 * [`rollDice.ts`](../../../../server/routes/rolls/rollDice.ts) uses `requireCharacterPlayer`, whose
 * own docblock says *a DM rolling for a player is out of scope*. So this hook answers `undefined` for
 * a DM and `RollsSection` draws the pool with no button — v3 Req 49.10's *absent, not present and
 * disabled*, applied to the one control where a stale-looking affordance would produce a **number**
 * somebody acts on.
 *
 * **The predicate lives here rather than in a wrapper**: this is the rolls surface's own hook, and
 * `handleRoll` has exactly one consumer, so a `useRollControls` around it would be an abstraction
 * with no second caller.
 *
 * Replaces `useCombatRoller` (TICKET-ROLL-06); keyed by roll **id** rather than a 3-letter code,
 * since a roll definition has none.
 *
 * **Validates: Concept 08; Requirements 15.1, 15.2, 15.3, 15.5; v3 Req 41.6, 42.7, 45.2, 49.10**
 */

import { useEffect, useState } from 'react';
import type { RandomSource } from '#shared/engine/dice/diceSimulator';
import { rollRollDefinition } from '#shared/engine/dice/rollDefinition';
import { describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import type { CalculatedCharacter } from '#shared/types/character';
import type { RollOutcome } from '#shared/types/formula';
import { fetchSessionRolls, ROLL_OUTCOME, sendRoll } from '../../../services/characterSync';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { type RollResult, useUIStore } from '../../../stores/uiStore';
import { useAuth } from '../../auth/useAuth';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';

export interface UseRollerOptions {
  /**
   * Randomness for the roll, defaulting to the engine's `Math.random`.
   *
   * The seam exists so tests can assert exact numbers; production passes nothing. **Unused on the
   * table path**, deliberately — there the dice are the server's, and a client-side source would be
   * a second place randomness could come from.
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

  const atTable = useCharacterStore((state) => state.tableCharacter?.id === characterId);
  const tableSessionId = useCharacterStore((state) => state.tableSessionId);
  // Who is holding the sheet open (TICKET-DM-05) — the shared predicate, not a fifth spelling of it
  const isDungeonMaster = useIsDungeonMaster(characterId);
  // Whose rolls to ask for. The Player's own, because `requireCharacterPlayer` means nobody else
  // could have rolled this character — the id is what the log is keyed by, so it is what narrows it
  const { accountId } = useAuth();

  /** Latest result per roll id — what the sheet shows beside the button */
  const [results, setResults] = useState<Record<string, RollOutcome>>({});

  /** A roll whose input does not evaluate: reported beside that roll, not fatally */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** The table's log, filtered to this character — empty and unread in local mode */
  const [tableHistory, setTableHistory] = useState<RollResult[]>([]);

  /**
   * Read this Player's rolls at the table, once, when the sheet opens
   *
   * **Narrowed by the route rather than here.** The log is capped, so filtering a table-wide window
   * in the browser is how a Player's own rolls fall off their own sheet on a busy table — the review
   * caught that, and `?rolledBy=` is the fix. The *table-wide* view of the same log is
   * TICKET-DM-04's roster and TICKET-LIVE-02's feed.
   *
   * There is no refresh after a roll: the route answers with the entry it just logged, so the
   * history grows from what came back rather than from a second request.
   */
  useEffect(() => {
    if (!atTable || !tableSessionId || !accountId) return;

    let live = true;

    void fetchSessionRolls(tableSessionId, accountId)
      .then(({ rolls }) => {
        if (live) setTableHistory(rolls.filter((roll) => roll.characterId === characterId));
      })
      .catch(() => {
        // A log that cannot be read is not a reason to break the sheet: the rolls still happened
        // and the Player can still make more. It reports itself by staying as it was.
      });

    return () => {
      live = false;
    };
  }, [atTable, tableSessionId, accountId, characterId]);

  /** Report a roll that produced no dice, beside the roll rather than fatally */
  const reportError = (rollId: string, message: string) => {
    setErrors((current) => ({ ...current, [rollId]: message }));
  };

  /** Adopt an outcome and clear any error standing against that roll */
  const acceptOutcome = (rollId: string, outcome: RollOutcome) => {
    setResults((current) => ({ ...current, [rollId]: outcome }));
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== rollId))
    );
  };

  /** Ask the table for a roll — the dice are the server's (v3 Req 45.2) */
  const rollAtTable = async (rollId: string) => {
    const answer = await sendRoll(characterId, rollId);

    if (answer.outcome === ROLL_OUTCOME.REFUSED) {
      reportError(rollId, answer.message);
      return;
    }

    // The entry the server logged, put straight at the top — the same object, so the result beside
    // the button and the row in the history cannot be two different readings of one roll
    acceptOutcome(rollId, answer.rolled);
    setTableHistory((current) => [answer.rolled, ...current]);
  };

  /** Roll in this browser — unchanged from v2.0, down to the in-memory history (D6) */
  const rollLocally = (rollId: string) => {
    if (!config || !calculated) return;

    const roll = (config.rollDefinitions ?? []).find((candidate) => candidate.id === rollId);
    if (!roll) return;

    try {
      const result = rollRollDefinition(roll, calculated, config, rng);

      // An input that does not evaluate comes back as an error value (TICKET-FORM-05): reported
      // beside this roll, with no result and no history entry.
      if (isFormulaError(result)) {
        reportError(rollId, describeFormulaError(result));
        return;
      }

      acceptOutcome(rollId, result);

      // Session history belongs to the UI store; it is deliberately never persisted
      addRollResult({
        ...result,
        id: crypto.randomUUID(),
        characterId,
        characterName: calculated.name,
      });
    } catch (error) {
      reportError(rollId, error instanceof Error ? error.message : String(error));
    }
  };

  const handleRoll = (rollId: string) => {
    if (atTable) {
      void rollAtTable(rollId);
      return;
    }

    rollLocally(rollId);
  };

  return {
    results,
    errors,
    /** This character's rolls, newest first — the store and the log both already order them */
    history: atTable
      ? tableHistory
      : rollHistory.filter((roll) => roll.characterId === characterId),
    /**
     * Forgets **this** character's rolls only — the button sits under a list scoped the same way
     *
     * Still a function at a table, and still the browser's list it clears, because that is all it
     * has ever been able to reach. What changes there is that the sheet does not *offer* it: a
     * table's log is the Event log, which is append-only, so a *Clear* button would be one that
     * lies. `CharacterSheet` already knows which home it is drawing and withholds `onClear`.
     */
    handleClearHistory: () => clearRollHistory(characterId),
    // No `atTable ||` here: `RollsSection` only renders once the sheet is ready, which already means
    // a config and a calculated character, so the extra disjunct enabled nothing — and if it ever
    // became reachable it would offer a roll whose pool the sheet could not show
    canRoll: config !== null && calculated !== null,
    /**
     * Throw a roll — **`undefined` for the table's DM**, whose roll the server refuses (TICKET-DM-05)
     *
     * Not folded into `canRoll` above, and the distinction is the ticket's: `canRoll` says *this roll
     * cannot be resolved right now* and disables a button that still means something, where this says
     * *this is not your roll to make* and there is no button at all.
     */
    handleRoll: isDungeonMaster ? undefined : handleRoll,
  };
}
