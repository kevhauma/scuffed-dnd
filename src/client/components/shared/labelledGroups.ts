/**
 * Labelled Groups
 *
 * Splitting a list into the headings the **ruleset's own words** name, in first-appearance order.
 * Three surfaces do it now and they did it three ways before TICKET-ITEM-01: the character sheet's
 * stat columns (`Stat.group` — TICKET-STAT-04), the inlay panel's gem headings (`Inlay.group` —
 * TICKET-INL-01) and the items panel's shops (`Item.shop`). The first two were the same twenty lines
 * twice, left standing under the no-abstraction-before-the-third-caller rule; the shop is the third
 * caller, so the rule says extract rather than copy again.
 *
 * The rule they share is the one worth having in one place: **a group is a distinct value that is
 * present**, never a list of names the app knows. Three groups make three headings and a fourth
 * makes a fourth, without an edit here — which is what *a heading the sheet happens to have is a
 * default, not a rule* means in code (v4 overview, *Rulings — ticket review*).
 *
 * Generic over the member rather than over the field name: the label is read by a function the
 * caller supplies, because `group` and `shop` are different fields on different entities and a
 * shared string key would be a third spelling of the same fact.
 *
 * Nothing here derives anything. A group decides where a row is printed and nothing else; a group
 * total or a per-group cap would be a new decision rather than an extension of this.
 *
 * **Validates: Requirements 13.4, 21.1-21.5; v4 systems/10, systems/11**
 */

/** One heading, and the entries listed under it */
export interface LabelledGroup<T> {
  /** The heading's name, or `null` for the entries the ruleset put under none */
  label: string | null;
  /** The entries, in the order they arrived */
  members: T[];
}

/**
 * Split a list into its groups, in first-appearance order
 *
 * A blank label is *ungrouped* rather than a group called `""`: every editor trims one away, but an
 * imported file is untrusted and the shape gate accepts any string — without this an empty label
 * would key a second group beside the unlabelled one and draw a heading with no name.
 *
 * @param entries - What to group, already in the order the surface wants to show it
 * @param labelOf - Which of the entry's fields names its group; `undefined` means ungrouped
 * @returns One entry per distinct label, ungrouped members collected under a `null` label
 */
export function groupByLabel<T>(
  entries: readonly T[],
  labelOf: (entry: T) => string | undefined
): LabelledGroup<T>[] {
  const headings = new Map<string | null, T[]>();

  for (const entry of entries) {
    const named = labelOf(entry)?.trim();
    const label = named ? named : null;
    const listed = headings.get(label);

    if (listed) {
      listed.push(entry);
    } else {
      headings.set(label, [entry]);
    }
  }

  const collected = [...headings.entries()];
  return collected.map(([label, members]) => ({ label, members }));
}

/**
 * Whether these groups are worth drawing as headings
 *
 * False for the list that names no groups at all — one unlabelled group is a flat list, and drawing
 * it under a blank heading would change how every existing ruleset reads.
 *
 * @param groups - What {@link groupByLabel} produced
 * @returns True when at least one group carries a name
 */
export function hasNamedGroups(groups: readonly LabelledGroup<unknown>[]): boolean {
  return groups.some((group) => group.label !== null);
}
