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
 * ## …and since TICKET-LIVE-02 that projection keeps up on its own
 *
 * The table's room is subscribed to while the sheet is open, so a roll lands in the log as it
 * happens rather than on the next read — which is [`useTableRollLog`](./useTableRollLog.ts)'s, not
 * this hook's. **That split is the ticket's, and it is a split of subjects**: *what has been rolled*
 * now has three sources (a read, a broadcast, and this hook's own `POST` answer) while *how a roll
 * is made* still has two homes, and the ordering and deduplication all three need belong with the
 * log rather than with the roller.
 *
 * **The DM gets no room here**, which is the one place this hook's two predicates meet: their log
 * is empty by the narrowing above, so a live feed would fill it from socket-open and omit
 * everything before that in silence. See `listeningTo` below.
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

import { useState } from 'react';
import type { RandomSource } from '#shared/engine/dice/diceSimulator';
import { rollRollDefinition } from '#shared/engine/dice/rollDefinition';
import { describeFormulaError, isFormulaError } from '#shared/engine/formula/errors';
import type { CalculatedCharacter } from '#shared/types/character';
import type { RollOutcome } from '#shared/types/formula';
import { ROLL_OUTCOME, sendRoll } from '../../../services/characterSync';
import { useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useUIStore } from '../../../stores/uiStore';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';
import { useTableRollLog } from './useTableRollLog';

/**
 * Which room this reader listens to for one character's rolls, if any (TICKET-LIVE-02)
 *
 * At module scope rather than inline, on TICKET-DM-05's precedent — a decision the hook body was
 * making is a decision that belongs outside it, and `fallow` measured this one taking `useRoller`
 * from 15 cognitive to 16 against a threshold of 15.
 *
 * **Two ways to answer *no*, and the second is the interesting one.** A character in this browser
 * has no table, so there is nothing to listen to (D6). And the table's **DM** deliberately listens
 * to nothing here: the log's mount read is narrowed to the reader's own Account, so a DM's comes
 * back empty — and a live feed on an empty panel would fill it from socket-open and omit everything
 * before that in silence. That is the outcome TICKET-LIVE-02's own note calls worse than an empty
 * log; the gap itself is TICKET-DM-04's to close, with the table-wide feed.
 *
 * @param atTable Whether the sheet's character plays at a game session
 * @param isDungeonMaster Whether the reader runs that table rather than owning the sheet
 * @param sessionId Which table, when there is one
 * @returns The room to join, or `null`
 */
function logRoomFor(
  atTable: boolean,
  isDungeonMaster: boolean,
  sessionId: string | null
): string | null {
  if (!atTable) return null;
  if (isDungeonMaster) return null;

  return sessionId;
}

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

  /** Latest result per roll id — what the sheet shows beside the button */
  const [results, setResults] = useState<Record<string, RollOutcome>>({});

  /** A roll whose input does not evaluate: reported beside that roll, not fatally */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * The table's log for this character — read once, then followed live (TICKET-LIVE-02)
   *
   * Whose room, and whether there is one at all, is {@link logRoomFor}'s answer: a local character
   * has no table, and the table's **DM** deliberately joins no room for the log. The DM's
   * *character* feed is unaffected — that is `useTableCharacterFeed`'s subscription, and the
   * connection beneath both counts its rooms.
   */
  const listeningTo = logRoomFor(atTable, isDungeonMaster, tableSessionId);

  const table = useTableRollLog(characterId, listeningTo, calculated?.name ?? '');

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
    // the button and the row in the history cannot be two different readings of one roll. `adopt`
    // rather than a prepend since TICKET-LIVE-02, because the broadcast of this very roll may have
    // arrived while the request was in flight.
    acceptOutcome(rollId, answer.rolled);
    table.adopt(answer.rolled);
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
      ? table.history
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
