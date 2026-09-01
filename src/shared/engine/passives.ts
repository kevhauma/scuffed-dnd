/**
 * Passive abilities — the catalog, resolved against who is holding them (TICKET-PAS-01)
 *
 * The workbook's `Background refernces abilities: passive` tab is a reference table of 26
 * resistances, immunities and senses, and the app's half of it is two things: a catalog on the
 * ruleset and a list of ids on the character
 * ([systems/14](../../../docs/v4.0_sheet_parity/systems/14-passives-and-reference-tables.md)). This
 * is the **read** side of the second one, and it is [`spellbook.ts`](./spellbook.ts)'s shape
 * deliberately: the two answer the same question about two entities, so answering it two different
 * ways would be the drift neither can afford.
 *
 * Nothing here is persisted. What a character *has* is a list of ids; what a reader *sees* is that
 * list resolved against the catalog at read time, so renaming a passive relabels every sheet
 * holding it on the next render.
 *
 * ## An id the ruleset no longer has is a row, not a gap and not a crash
 *
 * [`dependencies.ts`](./dependencies.ts) refuses to delete a passive somebody holds, so a stale id
 * reaches this only through a force-delete or a hand-edited file. When one does, {@link passivesOf}
 * yields an entry whose `passive` is `null` rather than dropping it — `spellbookOf`'s rule and
 * `CarriedBuild.item`'s before it. The holder is the only one who can be rid of it, and a row
 * nobody can see is a row nobody can revoke.
 *
 * ## Order is the catalog's, not the order they were handed out
 *
 * A sheet then reads the same way down every character's page, and a passive does not move when
 * another is granted. The held list's own order carries no meaning — unlike
 * `Character.focusSkillIds`, where the slot *is* the point — so nothing is lost by reading through
 * the catalog instead. A stale id has no place in that order and is appended after the rows that do.
 *
 * **Validates: v4 systems/14**
 */

import type { Character } from '../types/character';
import type { Passive } from '../types/config';

/**
 * One row of a character's passives: the id they hold, and what the ruleset says it is
 *
 * Both, because they answer different questions — the **id** is what a revoke names, and the
 * **passive** is what the row draws. `passive` is `null` for an id this ruleset no longer defines,
 * which is a state a surface renders rather than one it filters out (see the module header).
 */
export interface PassiveEntry {
  passiveId: string;
  passive: Passive | null;
}

/** What {@link passivesOf} needs of a ruleset — the catalog, which a ruleset may not have */
interface PassiveCatalog {
  passives?: Passive[];
}

/**
 * The passive abilities this character has been handed
 *
 * The one reader of the optional field, so *absent means none* is answered in a single place —
 * `learnedSpellIdsOf`'s, `focusPicksOf`'s and `dreamLevelOf`'s pattern, and for their reason: the
 * sheet, the grant rule and the dependency walker must not each decide what an untouched character
 * holds.
 *
 * **Returned as it stands, never de-duplicated or pruned.** Every write goes through
 * `grantPassive`, which refuses a duplicate, so a repeated id came from a hand-edited file — and
 * tidying it here would make a surface show one row where the document holds two entries no revoke
 * could tell apart.
 *
 * @param character The character whose passives are being read
 * @returns The held ids, or an empty list when there are none to read
 */
export function heldPassiveIdsOf(character: Pick<Character, 'passiveIds'>): readonly string[] {
  const stored = character.passiveIds;

  return Array.isArray(stored) ? stored : [];
}

/**
 * A character's passives, resolved against the ruleset's catalog
 *
 * Read at render time and stored nowhere — see the module header for why the order is the catalog's
 * and why a stale id survives as a row.
 *
 * @param character Whose passives
 * @param config The ruleset holding the catalog
 * @returns One entry per held id: catalog order first, then any id the ruleset has lost
 */
export function passivesOf(
  character: Pick<Character, 'passiveIds'>,
  config: PassiveCatalog
): PassiveEntry[] {
  const held = heldPassiveIdsOf(character);
  const catalog = config.passives ?? [];

  const known: PassiveEntry[] = catalog
    .filter((passive) => held.includes(passive.id))
    .map((passive) => ({ passiveId: passive.id, passive }));

  const lost: PassiveEntry[] = held
    .filter((passiveId) => !catalog.some((passive) => passive.id === passiveId))
    .map((passiveId) => ({ passiveId, passive: null }));

  return [...known, ...lost];
}

/**
 * The passives a character does **not** hold — what a handout picker offers
 *
 * Derived rather than tracked, which is what keeps the picker and the list from disagreeing: a
 * grant puts a row on the sheet and takes it out of the picker with neither control touching the
 * other. `spellbookOf`'s relationship with `SpellLearner`, one entity over.
 *
 * @param character Whose sheet the picker is on
 * @param config The ruleset holding the catalog
 * @returns Every catalog entry the character has not been handed, in catalog order
 */
export function grantablePassives(
  character: Pick<Character, 'passiveIds'>,
  config: PassiveCatalog
): Passive[] {
  const held = heldPassiveIdsOf(character);

  return (config.passives ?? []).filter((passive) => !held.includes(passive.id));
}
