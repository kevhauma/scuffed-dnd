/**
 * Spellbook Hook
 *
 * Owns the store selectors and every spell handler for one character: what is in the book, what may
 * still be learned, which pool a cast spends from, and the three writes (v4 systems/13,
 * TICKET-SPL-02). The panel renders; this decides.
 *
 * **The book is derived, not read** — `spellbookOf` is the sheet's own `FILTER` of the compendium
 * down to the learned rows, so learning a spell puts it in the book and takes it out of the picker
 * with neither handler saying so. There is one list, which is why the two cannot disagree.
 *
 * **The picker searches, because the compendium is four hundred rows.** `useSpellManager` reached the
 * same conclusion for the configuration panel and paged as well; this one does not, because what a
 * Player wants here is *the spell they already have in mind* rather than a browse — so the matches
 * are capped and the cap is stated rather than hidden behind page controls.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5**
 */

import { useMemo, useState } from 'react';
import { calculateCharacter } from '#shared/engine/calculator';
import { statVariables } from '#shared/engine/calculators/statCalculator';
import { namespacesFor } from '#shared/engine/formula/namespaces';
import { FORMULA_OWNER } from '#shared/engine/formula/scoping';
import type { ResolvedSegment } from '#shared/engine/formula/template';
import { resolveTemplate } from '#shared/engine/formula/template';
import { learnedSpellIdsOf, type SpellbookEntry, spellbookOf } from '#shared/engine/spellbook';
import type { Character } from '#shared/types/character';
import type { Configuration, Spell, Stat } from '#shared/types/config';
import type { FormulaContext } from '#shared/types/formula';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';

/** How many search matches the picker offers at once */
const MATCH_LIMIT = 20;

/** The empty search, and the value a `Select` holds for "nothing chosen" */
const NOTHING = '';

/**
 * One pool a cast may be paid from, with where it currently stands
 *
 * **Module-local**, unlike `useInventoryManager`'s `BackpackEntry` beside it: that one is a *prop*
 * on `BackpackRow`, and this is not a prop anywhere — the panel draws its own selector from the list
 * and infers the shape. Exporting it would be supported API nothing consumes, which is `fallow`'s
 * finding and `CharacterPatch`'s rule.
 */
interface CastingPool {
  id: string;
  name: string;
  /** What the character has left in it — the stored current, which is what a spend comes off */
  current: number;
}

/** How the picker narrows the compendium: a case-insensitive substring of the spell's name */
function matchesSearch(spell: Spell, query: string): boolean {
  const spelled = spell.name.toLowerCase();
  return spelled.includes(query);
}

/** The resource stats a cast may draw on, in the ruleset's own order */
function castingPools(stats: Stat[], currents: Record<string, number>): CastingPool[] {
  return stats
    .filter((stat) => stat.isResource)
    .map((stat) => ({ id: stat.id, name: stat.name, current: currents[stat.id] ?? 0 }));
}

/**
 * One row of the Spellbook, with its effect worked out for this caster (TICKET-SPL-03)
 *
 * The `entry` is the sheet's `FILTER` (which spell, and whether the ruleset still has it) and
 * `effect` is v4 D4's half — the same shape `ResolvedTemplate` draws in the config panel's preview,
 * so an author and a Player read one sentence rather than two spellings of one.
 */
interface SpellbookRowEntry {
  entry: SpellbookEntry;
  effect: ResolvedSegment[];
}

/**
 * Every learned spell's effect, resolved against what this character actually is
 *
 * **Derived at read time, like every other number on the sheet.** The caster's finished stats and
 * skills go in and a sentence comes out, so retuning a stat re-reads every effect on the next
 * render — nothing is stored and nothing is invalidated.
 *
 * The namespaces are `namespacesFor`'s at the **`spell-effect`** attachment point, which is what
 * makes this the same reading `scoping.ts` allows and `TemplatePreview` previews: a placeholder the
 * scope forbids resolves to an error value here rather than to a number the panel never showed.
 *
 * @param book - The learned entries, in compendium order
 * @param character - Whose sheet
 * @param config - The ruleset they play by
 * @returns One row per entry, its effect resolved
 */
function resolvedBook(
  book: SpellbookEntry[],
  character: Character,
  config: Configuration
): SpellbookRowEntry[] {
  const calculated = calculateCharacter(character, config);
  const namespaces = namespacesFor(
    {
      ...config,
      statValues: calculated.statValues,
      skillLevels: calculated.skillLevels,
      skillBonuses: calculated.skillBonuses,
    },
    FORMULA_OWNER.SPELL_EFFECT
  );

  /*
   * **Both spaces, not just the namespaces.** `scoping.ts` puts stat abbreviations in scope at this
   * attachment point — the sheet's own effect formulas read stat *cells*, so a transcriber may
   * write `{WIS}` — and a code the scope allows but the context cannot resolve is exactly CR-02's
   * bug: a placeholder that validates, previews and then errors at the table. `statVariables` is
   * the same call `rollCalculator` makes for the same reason.
   */
  const context: FormulaContext = {
    variables: statVariables(config.stats, calculated.statValues),
    namespaces,
  };

  return book.map((entry) => {
    const template = entry.spell?.effectTemplate ?? '';
    const effect = template === '' ? [] : resolveTemplate(template, context);

    return { entry, effect };
  });
}

/**
 * The Spellbook as the panel draws it — the filter and the resolution, both memoised
 *
 * **Extracted from {@link useSpellbook} because `fallow` said so**, and the finding was fair: adding
 * the resolution took that hook to 12 cyclomatic and 16 cognitive, and most of the weight was two
 * memos each repeating the same *have we got a character and a ruleset* guard. Lifting the pair out
 * leaves the caller reading as a list of what it offers.
 *
 * **Both halves are memoised, and for a reason rather than by habit.** Resolving runs
 * `calculateCharacter` — the whole sheet — once per render, and a Player with forty spells learned
 * would pay for it on every keystroke in the search box. `book` is memoised too so `rows` can depend
 * on it **honestly**: rebuilt each render it would be a new array every time and defeat the second
 * memo, which is the shape a suppression comment would have papered over.
 *
 * @param character Whose Spellbook, or `null` before one is open
 * @param config The ruleset they play by, or `null` before one is loaded
 * @returns One row per learned spell, its effect resolved; empty when either is missing
 */
function useSpellbookRows(
  character: Character | null,
  config: Configuration | null
): SpellbookRowEntry[] {
  const book: SpellbookEntry[] = useMemo(
    () => (character === null || config === null ? [] : spellbookOf(character, config)),
    [character, config]
  );

  return useMemo(
    () => (character === null || config === null ? [] : resolvedBook(book, character, config)),
    [book, character, config]
  );
}

export function useSpellbook(characterId: string) {
  const config = useConfigStore((state) => state.config);
  // Wherever it lives (TICKET-PLY-01) — a character at a table is not in the browser's own list
  const character = useCharacterStore((state) => selectCharacter(state, characterId));

  const learnSpell = useCharacterStore((state) => state.learnSpell);
  const unlearnSpell = useCharacterStore((state) => state.unlearnSpell);
  const castSpell = useCharacterStore((state) => state.castSpell);

  const [search, setSearch] = useState(NOTHING);
  const [poolId, setPoolId] = useState(NOTHING);

  const compendium = config?.spells ?? [];
  const rows = useSpellbookRows(character, config);

  const pools = castingPools(config?.stats ?? [], character?.currentResourceValues ?? {});

  /*
   * Which pool a cast spends from. Nothing in a ruleset says (the User's ruling: the Player picks at
   * cast time), so the choice is this component's state — and a ruleset with exactly one resource
   * answers it without asking, which is what makes the ordinary sheet a one-tap cast.
   *
   * Falling back to the first pool when the stored pick names none covers a resource the User
   * deleted under the Player, without leaving the panel pointing at a stat that no longer exists.
   */
  const chosen = pools.find((pool) => pool.id === poolId) ?? pools[0] ?? null;

  const learned = character === null ? [] : learnedSpellIdsOf(character);
  const query = search.trim().toLowerCase();

  const unlearned = compendium.filter((spell) => !learned.includes(spell.id));
  const matching =
    query === NOTHING ? [] : unlearned.filter((spell) => matchesSearch(spell, query));

  const handleLearn = (spellId: string) => {
    if (!character || !config) return;

    learnSpell(character.id, spellId, config);
    setSearch(NOTHING);
  };

  const handleUnlearn = (spellId: string) => {
    if (!character) return;

    unlearnSpell(character.id, spellId);
  };

  /** Cast one spell out of the chosen pool — every rule about whether it can be paid for is the Kernel's */
  const handleCast = (spellId: string) => {
    if (!character || !config || chosen === null) return;

    castSpell(character.id, spellId, chosen.id, config);
  };

  return {
    hasCharacter: character !== null,
    /**
     * Whether there is a Spellbook to draw at all
     *
     * **A compendium *or* a book, not just a compendium**, and that `||` is a bug the browser check
     * found rather than a defensive extra. A ruleset with no spells draws nothing, which is right —
     * but *force-deleting the last spell a character had learned* also empties the compendium, and
     * hiding the panel there would leave the Player holding an id no surface shows and no control
     * can clear. The lost-spell row exists to be cleared; this is what keeps it reachable.
     */
    hasSpells: compendium.length > 0 || rows.length > 0,
    /**
     * The learned subset, compendium order, with a lost id drawn as a row rather than dropped —
     * each row carrying its effect **resolved for this caster** (TICKET-SPL-03)
     */
    rows,
    /** Every resource stat, for the pool selector */
    pools,
    /** The pool a cast will spend from, or `null` on a ruleset with no resources to spend */
    chosenPool: chosen,
    setPoolId,
    search,
    setSearch,
    /** What the search matched, capped — empty until something is typed */
    matches: matching.slice(0, MATCH_LIMIT),
    /** How many it matched in full, so a capped list can say what it is not showing */
    matchCount: matching.length,
    matchLimit: MATCH_LIMIT,
    handleLearn,
    handleUnlearn,
    handleCast,
  };
}
