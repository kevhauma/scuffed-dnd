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
 * ## Three writes, and none of them the DM's (TICKET-DM-05)
 *
 * `learn-spell`, `unlearn-spell` and `cast-spell` are all behind `requireCharacterPlayer`, so the
 * three handlers are `undefined` for the table's DM and the panel draws the book as a reading. **Cast
 * is the interesting one**: a cast spends a pool, so a DM who wants one recorded moves the pool with a
 * quick action and the Player casts — which the panel says rather than leaving the reader to work out
 * why the button went.
 *
 * **Asking that one question cost three extractions**, and `fallow` is why: one more branch took this
 * hook to 13 cyclomatic / 17 cognitive — over the **cognitive** threshold, the cyclomatic one being
 * further off — which is the same measurement that split `useSpellbookRows` off it a ticket earlier.
 * {@link bindActs}, {@link choosePool} and {@link searchUnlearned} are what came out, and each stands
 * on its own — *which pool*, *what the search matched* and *what a writer may do* are three
 * decisions, and a hook that spelled all of them inline was a hook whose own subject had gone
 * missing. What is left reads as a list of what the panel is offered.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { useMemo, useState } from 'react';
import { FORMULA_OWNER } from '#shared/engine/formula/scoping';
import type { ResolvedSegment } from '#shared/engine/formula/template';
import { resolveTemplate } from '#shared/engine/formula/template';
import { learnedSpellIdsOf, type SpellbookEntry, spellbookOf } from '#shared/engine/spellbook';
import { templateContextFor } from '#shared/engine/templateContext';
import type { Character } from '#shared/types/character';
import type { Configuration, Spell, Stat } from '#shared/types/config';
import { selectCharacter, useCharacterStore } from '../../../stores/characterStore';
import { useConfigStore } from '../../../stores/configStore';
import { useIsDungeonMaster } from '../dm/useIsDungeonMaster';

/**
 * The three writes a Spellbook has, bound to the Player whose book it is
 *
 * **Optional fields, and all three move together** — `usePlayerControls`' shape for its reason: the
 * decision is made once, and the panel reads three absences rather than the hook asking *who is
 * reading* three times. A DM gets the empty set.
 */
interface SpellbookActs {
  learn?: (spellId: string) => void;
  unlearn?: (spellId: string) => void;
  cast?: (spellId: string) => void;
}

/**
 * The three store actions, taken off the store's own type so they cannot drift from it
 *
 * A `Pick` rather than three hand-written signatures: a fourth parameter added to `castSpell` should
 * fail to compile here rather than be silently re-declared as the old shape.
 */
type SpellWrites = Pick<
  ReturnType<typeof useCharacterStore.getState>,
  'learnSpell' | 'unlearnSpell' | 'castSpell'
>;

/**
 * Bind the three writes to the Player whose book this is (TICKET-DM-05)
 *
 * **One guard instead of three, and a hook that reads as a list of what it offers.** Each of the
 * three handlers used to open with its own *have we got a character and a ruleset*; asked once here,
 * the answer covers all three, and `useSpellbook`'s body is left saying what the panel gets rather
 * than what it is missing. That is the reason to keep this function.
 *
 * **It is not, on its own, what brought the hook back under the complexity threshold** — worth
 * stating, because the obvious reading is wrong and the next person will reach for it. Those guards
 * sat inside three arrow functions, and in **fallow's per-function accounting** a nested arrow is
 * measured as its own unit, so they were never in `useSpellbook`'s score to begin with; lifting them
 * out bought nothing and the wider expression that replaced them briefly cost three branches. What
 * actually paid was {@link choosePool} and {@link searchUnlearned} — decisions the hook body itself
 * was making. (That accounting is fallow's own. SonarSource-style cognitive complexity aggregates
 * nested functions upward with a nesting increment, so the same refactor scores differently there;
 * do not carry this reading to another tool.)
 *
 * The pool is checked **inside** the cast rather than gating the whole set, because a ruleset with no
 * resources still has a book to learn from and unlearn out of — only the cast has nothing to spend.
 *
 * @param character Whose book, or null before one is open
 * @param config The ruleset they play by, or null before one is loaded
 * @param pool Where a cast is paid from, or null on a ruleset with no resources to spend
 * @param store The character store's own three actions
 * @param clearSearch What to do once a spell lands in the book — the picker empties itself
 * @returns The three acts, or the empty set
 */
function bindActs(
  character: Character | null,
  config: Configuration | null,
  pool: CastingPool | null,
  store: SpellWrites,
  clearSearch: () => void
): SpellbookActs {
  if (character === null || config === null) return {};

  return {
    learn: (spellId: string) => {
      store.learnSpell(character.id, spellId, config);
      clearSearch();
    },
    unlearn: (spellId: string) => store.unlearnSpell(character.id, spellId),
    /** Every rule about whether a cast can be paid for is the Kernel's; this only names the pool */
    cast: (spellId: string) => {
      if (pool === null) return;

      store.castSpell(character.id, spellId, pool.id, config);
    },
  };
}

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
 * Which pool a cast spends from
 *
 * Nothing in a ruleset says (the User's ruling: the Player picks at cast time), so the choice is the
 * panel's own state — and a ruleset with exactly one resource answers it without asking, which is
 * what makes the ordinary sheet a one-tap cast.
 *
 * Falling back to the first pool when the stored pick names none covers a resource the User deleted
 * under the Player, without leaving the panel pointing at a stat that no longer exists.
 *
 * @param pools Every resource the ruleset defines, in its own order
 * @param poolId What the selector currently holds, or `''` for nothing chosen
 * @returns The pool, or null on a ruleset with no resources at all
 */
function choosePool(pools: CastingPool[], poolId: string): CastingPool | null {
  const picked = pools.find((pool) => pool.id === poolId);

  return picked ?? pools[0] ?? null;
}

/**
 * What the picker offers for a query — the compendium minus the book, narrowed and uncapped
 *
 * @param compendium Every spell the ruleset defines
 * @param character Whose book to subtract, or null before one is open
 * @param search What was typed, untrimmed
 * @returns The matches in full; the cap is the hook's, so it can say what it is not showing
 */
function searchUnlearned(
  compendium: Spell[],
  character: Character | null,
  search: string
): Spell[] {
  const query = search.trim().toLowerCase();
  if (query === NOTHING) return [];

  const learned = character === null ? [] : learnedSpellIdsOf(character);
  const unlearned = compendium.filter((spell) => !learned.includes(spell.id));

  return unlearned.filter((spell) => matchesSearch(spell, query));
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
 * The context is `templateContextFor`'s at the **`spell-effect`** attachment point, which is what
 * makes this the same reading `scoping.ts` allows and `TemplatePreview` previews: a placeholder the
 * scope forbids resolves to an error value here rather than to a number the panel never showed.
 * That helper is where the *both spaces* rule lives — namespaces **and** the flat stat
 * abbreviations, CR-02's bug — extracted at TICKET-PAS-01 when passives became its second caller
 * rather than copied into a second hook.
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
  const context = templateContextFor(character, config, FORMULA_OWNER.SPELL_EFFECT);

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

  // Who is holding the sheet open (TICKET-DM-05) — the shared predicate, not a fifth spelling of it
  const isDungeonMaster = useIsDungeonMaster(characterId);

  const [search, setSearch] = useState(NOTHING);
  const [poolId, setPoolId] = useState(NOTHING);

  const compendium = config?.spells ?? [];
  const rows = useSpellbookRows(character, config);

  const stats = config?.stats ?? [];
  const currents = character?.currentResourceValues ?? {};
  const pools = castingPools(stats, currents);

  const chosen = choosePool(pools, poolId);
  const matching = searchUnlearned(compendium, character, search);

  /*
   * One decision rather than three (TICKET-DM-05). The three routes share a guard, so a reader who
   * may make one may make all of them — asking the predicate per handler would be three chances for
   * the answers to drift apart. Everything else about *whether there is anything to write against*
   * is `bindActs`', which is what keeps this line to the one question this hook is asking.
   */
  const writes: SpellWrites = { learnSpell, unlearnSpell, castSpell };
  const clearSearch = () => setSearch(NOTHING);

  const acts = isDungeonMaster ? {} : bindActs(character, config, chosen, writes, clearSearch);

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
     * Whether this reader may not act, as distinct from having nothing to act with (TICKET-DM-05)
     *
     * **Answered here rather than inferred from an absent handler**, and the review caught why it has
     * to be: `handleLearn === undefined` is *also* true before a character or a ruleset has resolved,
     * so a panel reading absence would tell a **Player** that only the Player may act. That state is
     * not reachable through the app today — `CharacterSheet` returns `SheetStatusNotice` first — but
     * this panel is documented as owning its own answer, and an answer that is only right because of
     * something a caller does is not owned.
     *
     * Worth keeping in mind as the contrast with `usePlayerControls`, where absence *does* mean
     * exactly *the DM*: its six handlers are bound whatever the character and ruleset are, so there
     * is no second reason for one to be missing. That property is worth preserving there.
     */
    isReadOnly: isDungeonMaster,
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
    /** Put a spell in the book — `undefined` for the table's DM, whose learn meets a 404 */
    handleLearn: acts.learn,
    /** Take one out — the Player's own, for the reason a lost-spell row exists to be cleared */
    handleUnlearn: acts.unlearn,
    /**
     * Spend a pool on a cast — `undefined` for the table's DM
     *
     * The DM's route to the same outcome is the quick actions: a cast is a pool moving, and moving a
     * pool is `dm-adjust-resource`. The panel says so, because *the Cast button is missing* is not a
     * sentence a DM can act on.
     */
    handleCast: acts.cast,
  };
}
