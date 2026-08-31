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

import { useState } from 'react';
import { learnedSpellIdsOf, type SpellbookEntry, spellbookOf } from '#shared/engine/spellbook';
import type { Spell, Stat } from '#shared/types/config';
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
  const book: SpellbookEntry[] =
    character === null || config === null ? [] : spellbookOf(character, config);

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
    hasSpells: compendium.length > 0 || book.length > 0,
    /** The learned subset, compendium order, with a lost id drawn as a row rather than dropped */
    book,
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
