/**
 * Passives Hook
 *
 * What one character's passive abilities *are*: the ones they hold with their effects worked out,
 * and the ones they could still be handed (v4 systems/14, TICKET-PAS-01). The panel renders; this
 * decides.
 *
 * **The list and the picker are two readings of one fact.** `passivesOf` is the held subset of the
 * catalog and `grantablePassives` is its complement, both derived — so a grant puts a row on the
 * sheet and takes it out of the picker with neither of them saying so. `useSpellbook`'s relationship
 * with `SpellLearner`, one entity over, and `backpackOf`'s one further.
 *
 * ## It holds no write handler at all, unlike `useSpellbook`
 *
 * A spell is learned by exactly one actor, so that hook can own the writes. A passive is handed out
 * by **two** — the Player on their own local sheet, where there is no DM, and the table's DM through
 * a different pair of store actions with a different guard behind them — and *which of the two is
 * asking* is a fact about the reader rather than about the passives. So the handlers come from the
 * sheet's own action layers (`useSheetActions` and `useDmControls`, which is where every other
 * two-actor write on this page already lives) and reach the panel as props. A hook that branched on
 * the reader here would be a second place deciding who the DM is.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { useMemo } from 'react';
import { FORMULA_OWNER } from '#shared/engine/formula/scoping';
import type { ResolvedSegment } from '#shared/engine/formula/template';
import { resolveTemplate } from '#shared/engine/formula/template';
import { grantablePassives, type PassiveEntry, passivesOf } from '#shared/engine/passives';
import { templateContextFor } from '#shared/engine/templateContext';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/**
 * One passive on a sheet, with its effect worked out for this character
 *
 * **Module-local**, `SpellbookRowEntry`'s rule: the panel draws its own rows from the list and the
 * shape is not a prop anywhere, so exporting it would be supported API nothing consumes.
 */
interface PassiveRowEntry {
  entry: PassiveEntry;
  effect: ResolvedSegment[];
}

/**
 * Every held passive's effect, resolved against what this character actually is
 *
 * Derived at read time like every other number on the sheet: two of the workbook's 26 read
 * `perception level × 10` and `× 5`, so raising the skill re-reads them on the next render.
 * `templateContextFor` supplies **both** reference spaces at the `spell-effect` owner — the passive
 * catalog reuses that attachment point rather than minting one, because the reference set does not
 * differ.
 *
 * @param held - The held entries, in catalog order
 * @param character - Whose sheet
 * @param config - The ruleset they play by
 * @returns One row per entry, its effect resolved
 */
function resolvedPassives(
  held: PassiveEntry[],
  character: Character,
  config: Configuration
): PassiveRowEntry[] {
  const context = templateContextFor(character, config, FORMULA_OWNER.SPELL_EFFECT);

  return held.map((entry) => {
    const template = entry.passive?.effectText ?? '';
    const effect = template === '' ? [] : resolveTemplate(template, context);

    return { entry, effect };
  });
}

/**
 * The held passives as the panel draws them — the filter and the resolution, both memoised
 *
 * `useSpellbookRows`' shape and for its reason: resolving runs `calculateCharacter` — the whole
 * sheet — so an unmemoised pair would recompute it on every keystroke anywhere on the page. `held`
 * is memoised too so `rows` can depend on it **honestly**, rather than on a new array each render
 * that would defeat the second memo.
 *
 * @param character Whose passives, or `null` before one is open
 * @param config The ruleset they play by, or `null` before one is loaded
 * @returns One row per held passive, its effect resolved; empty when either is missing
 */
function usePassiveRows(
  character: Character | null,
  config: Configuration | null
): PassiveRowEntry[] {
  const held: PassiveEntry[] = useMemo(
    () => (character === null || config === null ? [] : passivesOf(character, config)),
    [character, config]
  );

  return useMemo(
    () => (character === null || config === null ? [] : resolvedPassives(held, character, config)),
    [held, character, config]
  );
}

export function usePassives(characterId: string) {
  const config = useConfigStore((state) => state.config);
  // Wherever it lives (TICKET-PLY-01) — a character at a table is not in the browser's own list
  const character = useCharacterStore((state) => selectCharacter(state, characterId));

  const catalog = config?.passives ?? [];
  const rows = usePassiveRows(character, config);

  const grantable =
    character === null || config === null ? [] : grantablePassives(character, config);

  return {
    /**
     * Whether there is anything to draw at all
     *
     * **A catalog *or* a held row, not just a catalog** — `useSpellbook.hasSpells`' `||`, which the
     * SPL-02 browser check earned rather than a defensive extra. A ruleset naming no passives draws
     * nothing, which is right; but force-deleting the last passive somebody held empties the catalog
     * *and* leaves them an id, and gating on the catalog alone would make that leftover unreachable
     * by the one control that can clear it.
     */
    hasPassives: catalog.length > 0 || rows.length > 0,
    /** The held subset, catalog order, each row carrying its effect resolved for this character */
    rows,
    /** What the picker offers — everything in the catalog they have not been handed */
    grantable,
  };
}
