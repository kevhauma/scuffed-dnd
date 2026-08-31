/**
 * Spellbook Panel
 *
 * The workbook's `Spellbook` sheet as a play surface: the learned subset of the compendium, the
 * search that grows it, and the pool a cast is paid out of (v4 systems/13, TICKET-SPL-02). Layout and
 * composition only — every decision lives in `useSpellbook`, and every write goes through a character
 * store action.
 *
 * **The book is the sheet's own `FILTER`**, derived by `spellbookOf` rather than read out of a stored
 * list, so learning a spell puts it in the book and takes it out of the search with neither control
 * touching the other. `InventoryPanel`'s Backpack for the same reason.
 *
 * **Each row's effect is resolved for this caster** (TICKET-SPL-03) — the hook evaluates the
 * template's placeholders against the character's finished stats and skills, so *"takes 11 fire
 * damage"* is 11 for them and re-reads itself the moment anything upstream moves.
 *
 * ## The pool selector, and why it is here rather than on each row
 *
 * Nothing in a ruleset says which resource casting draws on (User ruling, 2026-08-31: the Player
 * picks at cast time), and *which pool am I casting out of* is a fact about the session rather than
 * about one spell — so it is asked once, above the book. A ruleset with exactly one resource answers
 * it without asking, which is the ordinary sheet, and one with none disables *Cast* and says why.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5**
 */

import { useId } from 'react';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { SpellbookRow } from './SpellbookRow';
import { SpellLearner } from './SpellLearner';
import { useSpellbook } from './useSpellbook';

export interface SpellbookPanelProps {
  characterId: string;
}

export function SpellbookPanel({ characterId }: SpellbookPanelProps) {
  const poolSelectId = useId();

  const {
    hasSpells,
    rows,
    pools,
    chosenPool,
    setPoolId,
    search,
    setSearch,
    matches,
    matchCount,
    matchLimit,
    handleLearn,
    handleUnlearn,
    handleCast,
  } = useSpellbook(characterId);

  // A ruleset that knows no magic draws no panel at all, rather than an empty card asking a Player
  // to search four hundred spells that do not exist — `InventoryPanel`'s treatment of a ruleset with
  // no item templates, one level up. **A character still holding a learned id keeps the panel**
  // whatever the ruleset has left, or a force-deleted spell would be unclearable — see `hasSpells`.
  if (!hasSpells) return null;

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Spellbook
      </Text>

      {pools.length > 1 && (
        <div className="mb-3">
          <Label htmlFor={poolSelectId}>Cast from</Label>
          <Select
            id={poolSelectId}
            value={chosenPool?.id ?? ''}
            options={pools.map((pool) => ({
              value: pool.id,
              label: `${pool.name} — ${pool.current} left`,
            }))}
            onChange={(event) => setPoolId(event.target.value)}
            className="mt-1 w-full"
          />
        </div>
      )}

      {pools.length === 1 && chosenPool && (
        <Text variant="body-small-secondary" className="mb-3">
          {`Casting from ${chosenPool.name} — ${chosenPool.current} left.`}
        </Text>
      )}

      {pools.length === 0 && (
        <Text variant="body-small-secondary" className="mb-3">
          This ruleset defines no resource pools, so there is nothing to spend on a cast.
        </Text>
      )}

      {rows.length === 0 ? (
        <Text variant="body-small-secondary">No spells learned yet.</Text>
      ) : (
        rows.map(({ entry, effect }) => (
          <SpellbookRow
            key={entry.spellId}
            entry={entry}
            effect={effect}
            canCast={chosenPool !== null}
            onCast={handleCast}
            onUnlearn={handleUnlearn}
          />
        ))
      )}

      <div className="mt-4">
        <SpellLearner
          search={search}
          onSearch={setSearch}
          matches={matches}
          matchCount={matchCount}
          matchLimit={matchLimit}
          onLearn={handleLearn}
        />
      </div>
    </Card>
  );
}
