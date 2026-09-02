/**
 * One character's quick-action set, built the same way wherever it is drawn (TICKET-DM-04, v3 Req 49.7)
 *
 * [`quickActions.ts`](./quickActions.ts) turns a {@link QuickActionSource} into the action list. This
 * is where that source is *derived from a character and a Snapshot* — the step that used to live
 * inside [`useCharacterSheet`](../sheet/useCharacterSheet.ts) as two private functions, back when the
 * sidebar was the only placement.
 *
 * **v3 Req 49.7 asks for one definition across two placements, and this is the half that was missing.**
 * `quickActionsFor` was already shared; the *source* was not, so the sheet and TICKET-DM-04's roster
 * could each have decided for themselves what counts as a pool and what the experience preset is —
 * and two derivations that agree today are a drift with a date on it. With this module both callers
 * pass through one function, which is what makes
 * [`characterQuickActions.test.ts`](./characterQuickActions.test.ts)'s *both placements produce the
 * same set* an assertion about the code rather than about two copies that happen to match.
 *
 * **It reads the level itself rather than taking one.** The sheet has a level in hand and the roster
 * derives one per row, so a parameter would have been two callers' chances to pass a different number
 * into the same preset. `calculateCharacterLevel` is a pure curve lookup; asking it again is cheaper
 * than the bug.
 *
 * Pure, and beside [`derivedValue.ts`](./derivedValue.ts) and [`pointBudgetView.ts`](./pointBudgetView.ts)
 * for their reason: it is the part worth testing directly, and neither a hook nor a mapper should have
 * to render a card to assert a list.
 *
 * **Validates: v3 Req 49.1, 49.7**
 */

import { calculateCharacterLevel, experienceForLevel } from '#shared/engine/characterSummary';
import { isFormulaError } from '#shared/engine/formula/errors';
import type { CalculatedCharacter, Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { toDerivedValue } from './derivedValue';
import type { QuickAction, QuickActionPool, QuickActionSource } from './quickActions';
import { quickActionsFor } from './quickActions';

/**
 * What the ruleset prices this character's *next* level at, from where they stand (TICKET-DM-03)
 *
 * The one preset the experience quick actions offer, and it is the ruleset's own number rather than a
 * round one somebody liked: `experienceForLevel` reads the `xp_thresholds` curve forwards and
 * **refuses** anything that does not read back as the level asked for, so a single-row placeholder
 * curve answers `null` here instead of a confident 0 (TICKET-DM-01's ruling, D9). A `null` costs the
 * DM a preset and not the action — the amount box is offered either way.
 *
 * @param character Whose sheet
 * @param config The ruleset holding the curve
 * @param level The level they are at, or `null` when the curve could not say
 * @returns The experience still owed for the next level, or null when the curve cannot say
 */
function experienceStepFor(
  character: Character,
  config: Configuration,
  level: number | null
): number | null {
  if (level === null) return null;

  const next = experienceForLevel(character, config, level + 1);
  if (isFormulaError(next)) return null;

  const owed = next - character.experience;

  return owed > 0 ? owed : null;
}

/**
 * Every `isResource` stat, in the ruleset's own order, with the maximum the engine composed
 *
 * `max` is `null` for a pool whose formula could not be evaluated — a pool with no scale rather than
 * one whose scale is zero, which is the distinction `poolSteps` reads.
 *
 * @param config The ruleset, whose stats decide what a pool even is
 * @param calculated The engine's composed values for this character
 * @returns One entry per resource stat
 */
function poolsOf(config: Configuration, calculated: CalculatedCharacter): QuickActionPool[] {
  const ordered = [...config.stats].sort((first, second) => first.order - second.order);
  const resources = ordered.filter((stat) => stat.isResource);

  return resources.map((stat) => {
    const max = toDerivedValue(calculated.statValues[stat.id]);

    return { id: stat.id, name: stat.name, max: max.value };
  });
}

/**
 * What the Snapshot says about this character's pools and experience curve
 *
 * Exported for the one caller that wants the source without the list — a test asserting that two
 * placements are fed the same thing. Production callers want {@link quickActionsForCharacter}.
 *
 * @param character Whose sheet
 * @param config The ruleset it is read against
 * @param calculated The engine's result for the pair
 * @returns The derivation `quickActionsFor` consumes
 */
export function quickActionSourceFor(
  character: Character,
  config: Configuration,
  calculated: CalculatedCharacter
): QuickActionSource {
  const pools = poolsOf(config, calculated);
  const levelResult = calculateCharacterLevel(character, config);
  const level = toDerivedValue(levelResult);
  const experienceStep = experienceStepFor(character, config, level.value);

  return { pools, experienceStep };
}

/**
 * The Dungeon Master's quick actions for one character (v3 Req 49.1, 49.7)
 *
 * **The one entry point both placements use** — the sheet's sidebar and the session roster. Neither
 * builds a source of its own, and neither calls `quickActionsFor` directly, so the two cannot offer
 * different actions for one Snapshot.
 *
 * @param character Whose sheet
 * @param config The ruleset it is read against
 * @param calculated The engine's result for the pair
 * @returns Two actions per pool plus the four that move the character, in render order
 */
export function quickActionsForCharacter(
  character: Character,
  config: Configuration,
  calculated: CalculatedCharacter
): QuickAction[] {
  const source = quickActionSourceFor(character, config, calculated);

  return quickActionsFor(source);
}
