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
 * ## And the DM reads it rather than working it (TICKET-DM-05)
 *
 * All three writes are behind `requireCharacterPlayer`, so the table's DM gets the book, each row's
 * effect resolved for its caster, and none of the controls — no *Cast*, no *Unlearn*, no search to
 * learn from. The pool selector goes with them, because which pool a cast spends is a choice made at
 * cast time by whoever is casting.
 *
 * **Validates: v4 systems/13 gaps 2, 3; Requirements 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { useId } from 'react';
import { Card } from '../../ui/Card/Card';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';
import { NoControlsNotice } from '../shared/NoControlsNotice';
import { SpellbookRow } from './SpellbookRow';
import { SpellLearner } from './SpellLearner';
import { useSpellbook } from './useSpellbook';

export interface SpellbookPanelProps {
  characterId: string;
}

/**
 * What a reader with no Spellbook controls is told instead
 *
 * The ticket's own wrinkle, said on the panel rather than left to be worked out: a cast **spends a
 * pool**, so the DM's route to the same outcome is the quick actions, and the cast itself stays with
 * the person whose spell it is.
 */
const NO_CONTROLS =
  'Only the Player works their own Spellbook. A cast spends a pool — move it from the quick actions ' +
  'in the rail and let them cast.';

export function SpellbookPanel({ characterId }: SpellbookPanelProps) {
  const poolSelectId = useId();

  const {
    hasSpells,
    isReadOnly,
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

  /*
   * The three writes move together (TICKET-DM-05), and **the hook says so rather than this file
   * inferring it from an absent handler**: a missing `handleLearn` also means *no character or
   * ruleset resolved yet*, and reading that as *not your book* would tell a Player their own
   * Spellbook is somebody else's. The pool chrome goes with the writes, since *which pool am I
   * casting out of* is a question only the caster is being asked.
   */
  const canAct = !isReadOnly;

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Spellbook
      </Text>

      {isReadOnly && <NoControlsNotice message={NO_CONTROLS} />}

      {canAct && pools.length > 1 && (
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

      {canAct && pools.length === 1 && chosenPool && (
        <Text variant="body-small-secondary" className="mb-3">
          {`Casting from ${chosenPool.name} — ${chosenPool.current} left.`}
        </Text>
      )}

      {canAct && pools.length === 0 && (
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

      {handleLearn && (
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
      )}
    </Card>
  );
}
