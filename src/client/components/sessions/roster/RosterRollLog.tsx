/**
 * Every roll at this table, as it happens (TICKET-DM-04, v3 Req 41.6, 49.9)
 *
 * The table-wide log TICKET-LIVE-02's criterion 4 said did not exist, and the surface DM-05's *a DM
 * reading somebody's sheet sees an empty roll history* now defers to. It is read unnarrowed, so it is
 * complete from the table's first roll rather than from the moment a socket opened — which is the
 * whole reason the sheet's panel was left empty rather than filled live.
 *
 * **Attributed, which is what makes it a table's log rather than a sheet's.** Each row says which
 * character rolled and who rolled them, and both names are resolved at read time — never stored in the
 * Event's payload, so a rename cannot leave the history calling somebody by a name they no longer have.
 *
 * **No *Clear*.** The Event log is append-only, so a button would be one that lies — the same absence
 * `RollHistoryPanel` makes for a character at a table, and for the same reason.
 *
 * Layout and composition only.
 *
 * **Validates: v3 Req 41.6, 44.7, 49.9**
 */

import type { SessionRoll } from '#shared/types/api';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { sectionStyles } from '../sessions.style';
import { rollRowStyles } from './roster.style';

export interface RosterRollLogProps {
  /** Every roll at the table, newest first */
  rolls: SessionRoll[];
  /** True while the first read is in flight */
  isPending: boolean;
}

/** One roll: who threw what, and what it came to */
function RollRow({ roll }: { roll: SessionRoll }) {
  return (
    <div className={rollRowStyles}>
      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="body-small" as="span">
          {roll.characterName}
        </Text>
        <Text variant="caption" as="span">
          {roll.rollName}
        </Text>
        {/* `null` where the profile has gone, which the log says rather than guesses */}
        {roll.rolledBy !== null && (
          <Text variant="caption" as="span">
            by {roll.rolledBy}
          </Text>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <Text variant="caption" as="span">
          {roll.input} → {roll.notation}
        </Text>
        <Text variant="highlight" as="span">
          {roll.total}
        </Text>
      </div>
    </div>
  );
}

export function RosterRollLog({ rolls, isPending }: RosterRollLogProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Rolls at this table
        </Text>

        {isPending && rolls.length === 0 && (
          <Text variant="caption" as="p">
            Checking what has been rolled…
          </Text>
        )}

        {!isPending && rolls.length === 0 && (
          <Text variant="body-small-secondary" as="p">
            No rolls at this table yet. Every roll here is kept for the whole game.
          </Text>
        )}

        {rolls.map((roll) => (
          <RollRow key={roll.id} roll={roll} />
        ))}
      </section>
    </Card>
  );
}
