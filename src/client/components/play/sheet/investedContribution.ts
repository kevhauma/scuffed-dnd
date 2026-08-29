/**
 * The invested contribution row
 *
 * One line of a stat's breakdown — *what the points did* — shared by `StatsSection` and
 * `ResourcesSection` so the two cannot describe the same term differently. Both draw a `CountRow`
 * per stat and both label this term; it lives here rather than being written twice because since
 * TICKET-ARC-04 the label has a **branch** in it, and a three-way conditional duplicated across two
 * JSX blocks is the shape that drifts.
 *
 * (Extracted at its second caller rather than its third, deliberately: the rule against premature
 * abstraction is aimed at speculative generality, and this is measured duplication with two live
 * callers — `routes/entityName.ts`'s precedent, TICKET-GAM-01.)
 *
 * ## Why the label carries the spend and the value does not
 *
 * The **gain** is the term, not the points: since TICKET-ARC-02 the archetype's affinity decides
 * what a point buys, so `invested 15` against a total of 14 was the breakdown failing to add up.
 * The label carries the price so the exchange rate is legible — `invested 15 → +12` — which is what
 * a Player deciding where to spend actually needs.
 *
 * ## Why zero has two spellings (TICKET-ARC-04)
 *
 * `invested` on its own used to mean *spent nothing, gained nothing*, and it was true because a
 * zero spend bought exactly zero. It is not true any more: Dream level multiplies a main-tagged
 * stat's gain and adds to a sub-tagged one's, so an untouched stat can carry `+0.75` — or `+1` per
 * sub-tagged stat once an archetype tags any. Labelling that `invested +0.75` tells a Player they
 * invested in a stat they have never touched, which is the same class of mistake ARC-02 fixed when
 * it stopped this row showing the points instead of what they bought.
 *
 * So the arrow follows the **gain**, not the spend: any stat with something to show gets
 * `invested <n> →`, zero included, and the bare `invested` is kept for the one case it was always
 * about — nothing spent and nothing gained, which is still worth a row so that *"no points here"*
 * reads apart from *"no such contribution"*.
 *
 * **Validates: Concept 03; Requirements 13.4; v4 systems/05**
 */

import type { SkillContribution } from '../shared/SkillBreakdownRow';
import type { StatBreakdown } from './useCharacterSheet';

/**
 * What this stat's invested points bought, spelled for the breakdown panel
 *
 * @param stat - The stat's breakdown row, carrying both the spend and the gain it bought
 * @returns The contribution, always shown for an investable stat so a zero is legible
 */
export function investedContribution(stat: StatBreakdown): SkillContribution {
  const gain = stat.gain.value ?? 0;
  // A derived stat takes no points, so a forced `invested +0` would only mislead
  const isSilent = stat.invested === 0 && gain === 0;

  return {
    label: isSilent ? 'invested' : `invested ${stat.invested} →`,
    value: gain,
    alwaysShow: !stat.isDerived,
  };
}
