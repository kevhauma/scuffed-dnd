/**
 * Dream level — how far a character stands in their dream (TICKET-RES-04)
 *
 * The new workbook's identity block carries it beside Level and APT — *"Hoe ver je staat in je
 * dream"* — and it is **not inert**: the archetype gain formulas read it, a main-affinity stat
 * multiplying its point-table value by it and a sub-affinity stat adding it
 * ([systems/02](../../../docs/v4.0_sheet_parity/systems/02-progression-and-identity.md) gap 2,
 * TICKET-ARC-04).
 *
 * ## Why the *reader* owns the default rather than the stored shape
 *
 * `Character.dreamLevel` is optional and **absent means 1**. That is the reader's rule, deliberately,
 * for `purse`'s and `grantedStatPoints`' reason: a roster written before this ticket must round-trip
 * without growing a field, and a backfill would be a write nobody asked for over every character in
 * LocalStorage and every `character.data` on the server. One function answers *what is this
 * character's dream level* for the sheet, the gain formula and the DM's before/after alike, so the
 * three cannot disagree about what an untouched character is.
 *
 * **1 rather than 0 because the role is multiplicative** — a main-affinity gain is `table × dream`,
 * so the neutral value is the multiplicative identity, and the sheet's own sample agrees.
 *
 * **A stored number is returned as it stands, never repaired.** Only {@link setDreamLevel} writes
 * this field and it refuses anything below the floor, so clamping here would be a second rule
 * competing with that refusal — and a silent one, which is how a DM ends up believing a write landed.
 * The default covers *unreadable* rather than *disagreeable*: absent, `null`, or a `NaN` that would
 * otherwise turn every main-affinity gain into `NaN`.
 *
 * **Validates: v4 systems/02 gap 2**
 */

import type { Character } from '../types/character';

/**
 * What a character with no dream level stands at
 *
 * Exported because the refusal names it — *"cannot be below 1"* is this constant, not a literal
 * typed twice — and because {@link setDreamLevel} uses it as the floor.
 */
export const DEFAULT_DREAM_LEVEL = 1;

/**
 * How far this character stands in their dream
 *
 * @param character The character whose dream level is being read
 * @returns The stored level, or {@link DEFAULT_DREAM_LEVEL} when there is none to read
 */
export function dreamLevelOf(character: Character): number {
  const stored = character.dreamLevel;
  const isReadable = typeof stored === 'number' && Number.isFinite(stored);

  return isReadable ? stored : DEFAULT_DREAM_LEVEL;
}
