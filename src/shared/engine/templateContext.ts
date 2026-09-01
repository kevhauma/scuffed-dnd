/**
 * The formula context a character's own template text is resolved against (TICKET-PAS-01)
 *
 * A spell effect and a passive's effect are both **prose with formulas in it** (v4 D4), and both are
 * read *for a particular character*: the caster's finished stats and skills go in and a sentence
 * comes out. This is the one place that context is built.
 *
 * ## Why it is a module rather than a line in each hook
 *
 * It was a line in one hook. `useSpellbook.resolvedBook` (TICKET-SPL-03) composed
 * `calculateCharacter` + `namespacesFor` + **`statVariables`**, and the third of those is the part
 * worth extracting: `scoping.ts` puts bare stat abbreviations in scope at this attachment point, so
 * a context supplying namespaces alone leaves `{WIS}` validating, previewing and then failing at the
 * table — CR-02's bug, and the one SPL-03's own suite caught. Passives resolve the same text at the
 * same attachment point, and copying those three calls would have copied that fix by hand into a
 * second file, where the next reader has no way to know the third line is load-bearing.
 *
 * This is deduplication rather than anticipation: the second caller exists in the same change, and
 * the shared thing is the *subtlety*, not a shape somebody might want later.
 *
 * ## What it is not
 *
 * Not the **preview's** context. `config/shared/formulaSamples.ts` builds one from editable sample
 * values, because an author has no character — that difference is the whole reason the preview
 * exists, and folding the two together would make the preview claim to know numbers it cannot.
 *
 * Pure, and unaware of React and of storage like everything else in `engine/`.
 *
 * **Validates: v4 D4; v4 systems/13 gap 4; v4 systems/14**
 */

import type { Character } from '../types/character';
import type { Configuration } from '../types/config';
import type { FormulaContext } from '../types/formula';
import { calculateCharacter } from './calculator';
import { statVariables } from './calculators/statCalculator';
import { namespacesFor } from './formula/namespaces';
import type { FormulaOwner } from './formula/scoping';

/**
 * Everything a placeholder on this character's sheet may read
 *
 * **Both spaces, not just the namespaces.** The dotted namespaces come from `namespacesFor`, which
 * is driven by `scoping.ts`'s table so what a placeholder *may* name and what it *can* resolve
 * cannot drift apart; the flat map comes from `statVariables`, because the same table puts stat
 * abbreviations in scope at the template attachment points and the sheet's own effect formulas read
 * stat cells (`{WIS}`). Supplying one without the other is a placeholder that validates and then
 * errors — see the module header.
 *
 * **The whole character is calculated, once.** That is the price of an honest answer: an effect
 * reading a skill bonus needs the equipment pass and both stat passes to have run. Callers memoise
 * — `useSpellbook` and `usePassives` both do — rather than this module caching, which it could only
 * do by holding state it has no way to invalidate.
 *
 * @param character The character the text is being read for
 * @param config The ruleset they play by — the browser's, or a session's Snapshot
 * @param owner The attachment point the text is written at, which decides the scope
 * @returns The context to hand `resolveTemplate`
 */
export function templateContextFor(
  character: Character,
  config: Configuration,
  owner: FormulaOwner
): FormulaContext {
  const calculated = calculateCharacter(character, config);

  const source = {
    ...config,
    statValues: calculated.statValues,
    skillLevels: calculated.skillLevels,
    skillBonuses: calculated.skillBonuses,
  };

  const namespaces = namespacesFor(source, owner);
  const variables = statVariables(config.stats, calculated.statValues);

  return { variables, namespaces };
}
