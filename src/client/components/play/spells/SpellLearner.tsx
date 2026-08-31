/**
 * Spell Learner — the search that puts a spell in the book (v4 systems/13, TICKET-SPL-02)
 *
 * Spells unlock **manually** (User ruling, 2026-08-29): no level, no skill and no archetype gates
 * this, because the workbook gates it with nothing either. So the whole affordance is *find the one
 * you mean and switch it on*.
 *
 * **A search rather than a list**, because the compendium is four hundred rows and a `Select` of
 * four hundred options is a control nobody can use. It is a search rather than a *paged* list —
 * which is what the configuration panel does with the same data — because the two readers want
 * different things: a User building a ruleset browses it, and a Player already knows the spell's
 * name.
 *
 * **The cap is stated, never silent.** A query matching more than the panel offers says so, which is
 * the house rule about truncation applied to a UI list: a short list that looks complete is worse
 * than a short list that says it is not.
 *
 * **Validates: v4 systems/13 gap 2; Requirements 21.1-21.5**
 */

import { useId } from 'react';
import type { Spell } from '#shared/types/config';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export interface SpellLearnerProps {
  search: string;
  onSearch: (query: string) => void;
  /** What the query matched, already capped by the hook */
  matches: Spell[];
  /** How many it matched in full, so the cap can be named */
  matchCount: number;
  matchLimit: number;
  onLearn: (spellId: string) => void;
}

export function SpellLearner({
  search,
  onSearch,
  matches,
  matchCount,
  matchLimit,
  onLearn,
}: SpellLearnerProps) {
  const searchId = useId();
  const hasQuery = search.trim() !== '';

  return (
    <div className="rounded border border-stone-200 p-3">
      <Label htmlFor={searchId}>Learn a spell</Label>
      <Input
        id={searchId}
        value={search}
        placeholder="Search the compendium"
        onChange={(event) => onSearch(event.target.value)}
        className="mt-1 w-full"
      />

      {hasQuery && matchCount === 0 && (
        <Text variant="body-small-secondary" className="mt-2">
          Nothing left to learn by that name.
        </Text>
      )}

      {matches.map((spell) => (
        <div
          key={spell.id}
          className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-stone-200 border-b pb-2 last:border-b-0"
        >
          <Text variant="body-small" as="span">
            {spell.name}
          </Text>
          <Button variant="secondary" size="sm" onClick={() => onLearn(spell.id)}>
            Learn
          </Button>
        </div>
      ))}

      {matchCount > matchLimit && (
        <Text variant="caption" className="mt-2">
          {`Showing ${matchLimit} of ${matchCount} matches — narrow the search to see the rest.`}
        </Text>
      )}
    </div>
  );
}
