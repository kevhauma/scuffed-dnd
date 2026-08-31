/**
 * The Spellbook — the learned subset of the ruleset's compendium (TICKET-SPL-02)
 *
 * The workbook's `Spellbook` sheet is one `FILTER` of its 418-row spells table down to the rows
 * whose per-player flag reads `learned`, showing name / mana / range / effect
 * ([systems/13](../../../docs/v4.0_sheet_parity/systems/13-spells.md) gap 2). This is that filter,
 * and it is a **derivation**: a character stores which spells are on, the ruleset stores what each
 * one is, and what a Player reads is the two resolved against each other at read time. Nothing here
 * is persisted, which is why retuning a spell's mana cost relabels every Spellbook on the next read
 * — `backpackOf`'s rule, one entity over.
 *
 * ## An id the ruleset no longer has is a row, not a gap and not a crash
 *
 * [`dependencies.ts`](./dependencies.ts) refuses to delete a spell a character has learned, so a
 * stale id reaches this only through a force-delete or a hand-edited file. When one does,
 * {@link spellbookOf} yields an entry whose `spell` is `null` rather than dropping it — the
 * `CarriedBuild.item` precedent, and for its reason: the id is still the Player's, they are the only
 * one who can clear it, and a row they cannot see is one they cannot unlearn. Pruning on read would
 * be a repair nobody asked for and nobody could observe.
 *
 * ## Order is the compendium's, not the order they were learned in
 *
 * The sheet's `FILTER` returns its rows in table order, so a Spellbook reads the same way down every
 * character's page and a spell does not move when a Player learns another one. The learned list's
 * own order carries no meaning — unlike {@link Character.focusSkillIds}, where the slot is the
 * point — so nothing is lost by reading through the compendium instead. A stale id has no place in
 * that order and is appended after the rows that do, in the order it was learned.
 *
 * **Validates: v4 systems/13 gap 2**
 */

import type { Character } from '../types/character';
import type { Spell } from '../types/config';

/**
 * One row of the Spellbook: the id that is switched on, and what the ruleset says it is
 *
 * Both, because they answer different questions — the **id** is what an unlearn or a cast names, and
 * the **spell** is what the row draws. `spell` is `null` for an id this ruleset no longer defines,
 * which is a state a surface renders rather than one it filters out (see the module header).
 */
export interface SpellbookEntry {
  spellId: string;
  spell: Spell | null;
}

/** What {@link spellbookOf} needs of a ruleset — the compendium, which a ruleset may not have */
interface SpellbookRuleset {
  spells?: Spell[];
}

/**
 * The spells this character has unlocked, in the order they were learned
 *
 * The one reader of the optional field, so *absent means none* is answered in a single place —
 * `focusPicksOf`'s and `dreamLevelOf`'s pattern, and for their reason: the Spellbook, the cast rule
 * and the dependency walker must not each decide what an untouched character knows.
 *
 * **Returned as it stands, never de-duplicated or pruned.** Every write goes through
 * `addLearnedSpell`, which refuses a duplicate, so a repeated id came from a hand-edited file — and
 * tidying it here would make a surface show one row where the document holds two entries no unlearn
 * could tell apart.
 *
 * @param character The character whose spells are being read
 * @returns The learned ids, or an empty list when there are none to read
 */
export function learnedSpellIdsOf(
  character: Pick<Character, 'learnedSpellIds'>
): readonly string[] {
  const stored = character.learnedSpellIds;

  return Array.isArray(stored) ? stored : [];
}

/**
 * The Spellbook: every learned spell, resolved against the compendium
 *
 * The sheet's `FILTER`, and the play surface's whole list. Read at render time and stored nowhere —
 * see the module header for why the order is the compendium's and why a stale id survives as a row.
 *
 * @param character Whose Spellbook
 * @param config The ruleset holding the compendium
 * @returns One entry per learned id: compendium order first, then any id the ruleset has lost
 */
export function spellbookOf(
  character: Pick<Character, 'learnedSpellIds'>,
  config: SpellbookRuleset
): SpellbookEntry[] {
  const learned = learnedSpellIdsOf(character);
  const compendium = config.spells ?? [];

  const known: SpellbookEntry[] = compendium
    .filter((spell) => learned.includes(spell.id))
    .map((spell) => ({ spellId: spell.id, spell }));

  const lost: SpellbookEntry[] = learned
    .filter((spellId) => !compendium.some((spell) => spell.id === spellId))
    .map((spellId) => ({ spellId, spell: null }));

  return [...known, ...lost];
}
