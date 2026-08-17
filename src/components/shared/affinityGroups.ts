/**
 * Affinity Groups
 *
 * An archetype's stats grouped by how much it favours them (Concept 03), plus the words each group
 * is listed under. Shared because both surfaces that show an archetype ask the same question — the
 * configuration card and the wizard's archetype step — and a per-stat list saying `non` fourteen
 * times is not what either of them wants to render.
 *
 * The `non`-by-default rule is **not** re-implemented here: it comes from the engine's
 * `affinityFor`, which is the one definition of what an untagged stat is worth. This module only
 * decides the order the groups appear in and what they are called.
 *
 * **Validates: Concept 03; Requirements 21.1-21.5**
 */

import { affinityFor } from '../../engine/calculators/pointBuy';
import type { Archetype, Stat, StatAffinity } from '../../types';
import { STAT_AFFINITIES } from '../../types';

/**
 * What each affinity is called where a Player reads it
 *
 * Module-private on purpose: it reaches callers through `AffinityGroup.label`, so no surface has to
 * remember to look a label up — which is what stopped the two of them drifting in the first place.
 */
const AFFINITY_LABELS: Record<StatAffinity, string> = {
  main: 'Main',
  sub: 'Sub',
  non: 'Non',
};

/** One affinity and the stats an archetype gives it */
export interface AffinityGroup {
  affinity: StatAffinity;
  label: string;
  stats: Stat[];
}

/**
 * Group an archetype's stats by affinity, most favoured first
 *
 * Empty groups are dropped: an archetype that favours nothing has nothing to say under `Main`.
 *
 * @param archetype - The archetype whose tagging is being read
 * @param stats - The ruleset's stats, in display order
 * @returns One entry per non-empty affinity, in {@link STAT_AFFINITIES} order
 */
export function groupStatsByAffinity(archetype: Archetype, stats: Stat[]): AffinityGroup[] {
  return STAT_AFFINITIES.map((affinity) => ({
    affinity,
    label: AFFINITY_LABELS[affinity],
    stats: stats.filter((stat) => affinityFor(archetype, stat.id) === affinity),
  })).filter((group) => group.stats.length > 0);
}
