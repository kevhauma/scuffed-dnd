/**
 * Passives Panel
 *
 * The passive abilities this character has been handed, with their effects worked out for them (v4
 * systems/14, TICKET-PAS-01). Layout and composition only — every decision lives in `usePassives`,
 * and every write goes through a character store action.
 *
 * **The list is derived, never read.** `passivesOf` resolves the character's ids against the
 * ruleset's catalog at render time, so renaming a passive relabels every sheet holding it and
 * retuning the skill Blindsight reads re-reads its range. The picker is the same list's complement,
 * which is why granting one moves it between the two without either control saying so.
 *
 * ## Who may change what is held, and why the panel asks rather than being told
 *
 * *Who may hand a passive out* is the ticket's one real question, and the answer differs by where
 * the character lives. **Locally the Player writes it themselves** — signed out there is no DM, and
 * the person keeping their own sheet plays both parts, which is `dreamLevel`'s and experience's
 * established split. **At a table they may not**: the handout is the DM's and has no player route at
 * all. `usePassiveHandout` decides which of the two is asking — composed here rather than threaded
 * down from the sheet, which is `SpellbookPanel`'s arrangement and which keeps the decision out of
 * a JSX conditional. An absent control says *not yours* where a disabled one would say *not now*.
 *
 * **One panel serves both actors rather than a second copy on the DM's card.** The list and the
 * control that changes it belong together, and the DM reading a player's sheet sees this panel with
 * its buttons live where the Player at that table sees it without them — one component rather than
 * two showing the same rows. Which store actions those buttons reach is the hook's answer; the guard
 * behind them is the server's.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';
import { PassiveGranter } from './PassiveGranter';
import { PassiveRow } from './PassiveRow';
import { usePassiveHandout } from './usePassiveHandout';
import { usePassives } from './usePassives';

export interface PassivesPanelProps {
  characterId: string;
  /**
   * Whether the open character plays at a game session
   *
   * The one thing about the handout the panel cannot work out for itself, and it is a fact about
   * the *sheet* rather than about the passives — so it arrives as a prop and everything downstream
   * of it is `usePassiveHandout`'s. `SpellbookPanel` takes only a `characterId` because a spell is
   * learned by one actor; a passive is handed out by two.
   */
  atTable: boolean;
}

export function PassivesPanel({ characterId, atTable }: PassivesPanelProps) {
  const { hasPassives, rows, grantable } = usePassives(characterId);
  const handout = usePassiveHandout(characterId, atTable);

  // A ruleset naming no passives draws no panel at all, rather than an empty card about a catalog
  // that does not exist — `SpellbookPanel`'s treatment, and `hasPassives` carries its `||` for the
  // same reason: a character still holding a force-deleted id keeps the panel that can clear it.
  if (!hasPassives) return null;

  return (
    <Card className="p-6">
      <Text variant="h4" as="h2" className="mb-3">
        Passive abilities
      </Text>

      {rows.length === 0 ? (
        <Text variant="body-small-secondary">No passive abilities yet.</Text>
      ) : (
        rows.map(({ entry, effect }) => (
          <PassiveRow
            key={entry.passiveId}
            entry={entry}
            effect={effect}
            onRevoke={handout?.revoke}
          />
        ))
      )}

      {handout && (
        <div className="mt-4">
          <PassiveGranter grantable={grantable} onGrant={handout.grant} />
        </div>
      )}
    </Card>
  );
}
