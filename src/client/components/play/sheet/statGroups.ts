/**
 * Stat Groups
 *
 * The sheet's stats, split into the columns the ruleset names (TICKET-STAT-04). The source
 * spreadsheet lays its nine stats out under *Physical*, *Mental* and *Vitals*; `Stat.group` is
 * where the User writes that down, and this is the one place a list of stats becomes a list of
 * columns.
 *
 * A pure mapper in its own module, for the same reason `derivedValue.ts` and `pointBudgetView.ts`
 * are: **two** sections render stats — `StatsSection` and `ResourcesSection`, which the sheet
 * splits because a pool is read for a different reason than a stat — and *which column a stat
 * falls in* must not be answered twice, once per section, in case the two answers drift. A group
 * spanning both sections therefore appears as a column in each, which is the honest rendering of
 * a sheet that groups by column and the app that separates pools from stats.
 *
 * The columns these describe are **drawn** by `StatGroupColumns`; this module decides only what
 * they are.
 *
 * **Groups are the distinct values present, in the stats' own order** — never a list of three
 * names. A ruleset naming four groups renders four columns, and one naming none comes back as a
 * single unlabelled group, which is the flat list the sheet has always drawn.
 *
 * Nothing here derives anything. A group decides where a row is printed and nothing else; a group
 * total or a per-group cap would be a new decision rather than an extension of this.
 *
 * **Validates: Requirements 13.4, 21.1-21.5**
 */

import type { StatBreakdown } from './useCharacterSheet';

/** One column of the sheet's stats */
export interface StatGroup {
  /** The group's name, or `null` for the stats the ruleset put in no group */
  label: string | null;
  /** The group's stats, in the order they arrived */
  stats: StatBreakdown[];
}

/**
 * Split stats into their groups, in first-appearance order
 *
 * @param stats - The stats to render, already in the ruleset's own order
 * @returns One entry per distinct group, ungrouped stats collected under a `null` label
 */
export function groupStats(stats: StatBreakdown[]): StatGroup[] {
  const columns = new Map<string | null, StatBreakdown[]>();

  for (const stat of stats) {
    // A blank group is ungrouped, not a group named "". The editor already trims one away, but an
    // imported file is untrusted and the shape gate accepts any string — without this an empty
    // label would key a second column beside the unlabelled one and draw a heading with no name
    const named = stat.group?.trim();
    const label = named ? named : null;
    const column = columns.get(label);

    if (column) {
      column.push(stat);
    } else {
      columns.set(label, [stat]);
    }
  }

  const entries = [...columns.entries()];
  return entries.map(([label, grouped]) => ({ label, stats: grouped }));
}

/**
 * Whether these groups are worth drawing as columns
 *
 * False for the ruleset that names no groups at all — one unlabelled column is a flat list, and
 * drawing it as a grid under a blank heading would change how every existing ruleset reads.
 *
 * @param groups - What `groupStats` produced
 * @returns True when at least one group carries a name
 */
export function hasNamedGroups(groups: StatGroup[]): boolean {
  return groups.some((group) => group.label !== null);
}
