/**
 * One character on the roster: where they stand, and what a DM can do about it (TICKET-DM-04)
 *
 * The row v3 Req 49.8 asks for — level, unspent points, and current-versus-maximum for every resource
 * — with the quick actions beside it.
 *
 * **Every cell is a `DerivedValue`, so a value that could not be calculated chips rather than showing
 * a confident number** (v3 Req 49.7's sibling concern, and the sheet's own discipline). It matters more
 * in a dense grid than on a sheet: twenty confident numbers with one quiet lie in them is harder to
 * catch than one chipped cell. A level off the end of the `xp_thresholds` curve and a resource whose
 * formula is broken both land here as chips, through the same `toDerivedValue` → `ErrorChip` pair the
 * sheet uses.
 *
 * **No resource is named in this file.** The pools come from the Snapshot and carry their own words
 * (v3 Req 49.2).
 *
 * Layout and composition only, on `components/ui` primitives and theme tokens.
 *
 * **Validates: v3 Req 49.7, 49.8, 49.10; Requirements 20.1-20.5, 21.1-21.5**
 */

import type { CharacterAdjustment } from '#shared/types/api';
import type { AdjustmentVocabulary } from '../../play/dm/adjustmentVocabulary';
import type { DerivedValue } from '../../play/shared/derivedValue';
import { Button } from '../../ui/Button/Button';
import { ErrorChip } from '../../ui/ErrorChip/ErrorChip';
import { Text } from '../../ui/Text/Text';
import { RosterQuickActions } from './RosterQuickActions';
import {
  cellLabelStyles,
  cellStyles,
  cellsStyles,
  characterHeaderStyles,
  characterRowStyles,
  overMaxStyles,
} from './roster.style';
import type { RosterCharacter } from './rosterView';

export interface CharacterRosterRowProps {
  character: RosterCharacter;
  /** How this ruleset spells what an adjustment names */
  words: AdjustmentVocabulary;
  /** What this browser has watched happen to them, for the quick actions' outcome and undo */
  adjustments: CharacterAdjustment[];
  /** Whether this reader may act on them as the table's DM — see `useSessionRoster` */
  canAct: boolean;
  /** Whether this reader may open their sheet: their own, or anybody's if they run the table */
  canOpen: boolean;
  onOpen: (characterId: string) => void;
}

/** One labelled number, or the chip that stands in for it */
function Cell({ label, value }: { label: string; value: DerivedValue }) {
  return (
    <span className={cellStyles}>
      <span className={cellLabelStyles}>{label}</span>
      {value.error === null ? (
        <Text variant="highlight" as="span">
          {value.value}
        </Text>
      ) : (
        <ErrorChip label={label} detail={value.error} />
      )}
    </span>
  );
}

/**
 * One pool, as `current / maximum`
 *
 * The stored current is shown whatever the maximum turns out to be, and flagged rather than corrected
 * when it is the higher of the two (TICKET-RES-03) — a derived maximum must never silently overwrite
 * what a Player is tracking, and on a roster the DM is the one who needs to notice.
 */
function Pool({ name, current, max, isOverMax }: RosterCharacter['pools'][number]) {
  return (
    <span className={cellStyles}>
      <span className={cellLabelStyles}>{name}</span>
      <Text variant="highlight" as="span" className={isOverMax ? overMaxStyles : ''}>
        {current}
      </Text>
      <Text variant="caption" as="span">
        /
      </Text>
      {max.error === null ? (
        <Text variant="caption" as="span">
          {max.value}
        </Text>
      ) : (
        <ErrorChip label="max" detail={max.error} />
      )}
    </span>
  );
}

export function CharacterRosterRow({
  character,
  words,
  adjustments,
  canAct,
  canOpen,
  onOpen,
}: CharacterRosterRowProps) {
  return (
    <div className={characterRowStyles}>
      <div className={characterHeaderStyles}>
        <Text variant="body" as="span">
          {character.name}
        </Text>

        {canOpen && (
          <Button variant="secondary" size="xs" onClick={() => onOpen(character.id)}>
            {/* Said plainly, because the two pages differ: the DM gets a sheet with their own
                controls on it, and nothing of the Player's is theirs to press */}
            {canAct ? 'Open as DM' : 'Open sheet'}
          </Button>
        )}
      </div>

      {character.failure === null ? (
        <div className={cellsStyles}>
          <Cell label="Level" value={character.level} />

          {character.budget && (
            <Cell label="Points to use" value={character.budget.pointsRemaining} />
          )}

          {character.pools.map((pool) => (
            <Pool key={pool.id} {...pool} />
          ))}
        </div>
      ) : (
        // An actual throw from the engine — a bug rather than a ruleset mistake, since a broken
        // formula is an error value and chips its own cell. One character that cannot be calculated
        // says so and leaves the rest of the table readable.
        <ErrorChip label="cannot be calculated" detail={character.failure} />
      )}

      {canAct && character.failure === null && (
        <RosterQuickActions
          characterId={character.id}
          characterName={character.name}
          actions={character.quickActions}
          adjustments={adjustments}
          words={words}
          grantedPoints={character.grantedPoints}
        />
      )}
    </div>
  );
}
