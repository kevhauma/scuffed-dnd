/**
 * One Member and everything they are playing (TICKET-DM-04, v3 Req 39.7, 49.8)
 *
 * The roster's unit. It carries what TICKET-GAM-04's lobby row carried — the role, the name, the
 * connection, and whatever this reader may do about the seat — and puts that Member's characters
 * underneath it with their numbers, which is what lets one list answer *who is here* and *where do
 * they stand* at once.
 *
 * **Presence belongs to the person, not the row**, which is why the badge is here and not on a
 * character: a Member playing two characters is one browser, and a Member playing none is still
 * somebody the DM needs to see is connected. `PresenceBadge` and the judgement behind it are
 * TICKET-LIVE-03's `components/live/` modules, imported rather than redrawn.
 *
 * **What each reader may do to whom is the server's rule, drawn rather than guessed** — GAM-04's
 * wording and its reasons, kept: the DM may take anybody else's seat and hand the game over,
 * everybody may give up their own, and the DM's own row offers neither, because a table with no DM
 * has nobody who can invite, archive or transfer (v3 Req 39.6).
 *
 * **Validates: v3 Req 39.3, 39.4, 39.5, 39.6, 39.7, 44.8, 49.8**
 */

import type { CharacterAdjustment } from '#shared/types/api';
import { MEMBER_ROLE, type MemberRole } from '#shared/types/api';
import { PresenceBadge } from '../../live/PresenceBadge';
import type { PresenceState } from '../../live/presenceState';
import type { AdjustmentVocabulary } from '../../play/dm/adjustmentVocabulary';
import { readableMoment } from '../../shared/readableMoment';
import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';
import { dmBadgeStyles, playerBadgeStyles } from '../sessions.style';
import { CharacterRosterRow } from './CharacterRosterRow';
import { departedStyles, groupHeaderStyles, groupStyles } from './roster.style';
import type { LobbyAction } from './rosterActions';
import { LOBBY_ACTION } from './rosterActions';
import type { RosterGroup } from './rosterView';

/** What a role is called on a row, matching the badges the games list uses */
const ROLE_BADGE: Record<MemberRole, { label: string; className: string }> = {
  [MEMBER_ROLE.DM]: { label: 'Runs this game', className: dmBadgeStyles },
  [MEMBER_ROLE.PLAYER]: { label: 'Player', className: playerBadgeStyles },
};

export interface MemberGroupProps {
  group: RosterGroup;
  /** Whether this Member's browser is on the table's feed, decided once for the whole list */
  presence: PresenceState;
  /** How this ruleset spells what an adjustment names */
  words: AdjustmentVocabulary;
  /** True when the reader runs this table */
  isDm: boolean;
  /** False for an archived table, where the server refuses to hand the game over */
  canTransfer: boolean;
  isBusy: boolean;
  /** Whether this reader may act on that character as the table's DM */
  actsAsDm: (ownerAccountId: string) => boolean;
  /** What this browser has watched happen to one character */
  adjustments: (characterId: string) => CharacterAdjustment[];
  onOpenCharacter: (characterId: string) => void;
  onAsk: (action: LobbyAction, accountId: string, name: string) => void;
}

/**
 * The characters nobody at the table owns any more (v3 Req 39.3)
 *
 * **They keep their numbers here**, which GAM-04's lobby could not give them: it listed their names
 * under a caption, because it had no Snapshot to read them against. Retention means the sheets stay
 * readable, and a name on its own is not a readable sheet.
 */
function DepartedGroup({
  group,
  words,
  adjustments,
  onOpenCharacter,
}: Pick<MemberGroupProps, 'group' | 'words' | 'adjustments' | 'onOpenCharacter'>) {
  return (
    <div className={departedStyles}>
      <Text variant="body-small-secondary" as="p">
        Still at the table, but their player has gone. Everybody can read them; nobody can change
        them.
      </Text>

      {group.characters.map((character) => (
        <CharacterRosterRow
          key={character.id}
          character={character}
          words={words}
          adjustments={adjustments(character.id)}
          // Writable by nobody, the DM included — `requireCharacterWriter` asks whether the owner
          // still holds a seat before it asks anything about the caller (v3 Req 39.3)
          canAct={false}
          canOpen={false}
          onOpen={onOpenCharacter}
        />
      ))}
    </div>
  );
}

export function MemberGroup({
  group,
  presence,
  words,
  isDm,
  canTransfer,
  isBusy,
  actsAsDm,
  adjustments,
  onOpenCharacter,
  onAsk,
}: MemberGroupProps) {
  const member = group.member;

  if (member === null) {
    return (
      <DepartedGroup
        group={group}
        words={words}
        adjustments={adjustments}
        onOpenCharacter={onOpenCharacter}
      />
    );
  }

  const badge = ROLE_BADGE[member.role];
  const isTheDm = member.role === MEMBER_ROLE.DM;

  return (
    <div className={groupStyles}>
      <div className={groupHeaderStyles}>
        <div className="flex flex-col">
          <span className={badge.className}>{badge.label}</span>
          <Text variant="body" as="span">
            {member.name}
            {group.isYou && ' (you)'}
          </Text>
          <Text variant="caption" as="span">
            Joined {readableMoment(member.joinedAt)}
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PresenceBadge state={presence} />

          {/* The DM's own row offers nothing — leaving is refused until the game is handed over */}
          {group.isYou && !isTheDm && (
            <Button
              variant="danger"
              size="sm"
              disabled={isBusy}
              onClick={() => onAsk(LOBBY_ACTION.LEAVE, member.accountId, member.name)}
            >
              Leave
            </Button>
          )}
          {isDm && !group.isYou && (
            <>
              {canTransfer && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => onAsk(LOBBY_ACTION.TRANSFER, member.accountId, member.name)}
                >
                  Hand over
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                disabled={isBusy}
                onClick={() => onAsk(LOBBY_ACTION.REMOVE, member.accountId, member.name)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </div>

      {group.characters.length === 0 ? (
        <Text variant="caption" as="span">
          No character yet
        </Text>
      ) : (
        group.characters.map((character) => (
          <CharacterRosterRow
            key={character.id}
            character={character}
            words={words}
            adjustments={adjustments(character.id)}
            canAct={actsAsDm(character.ownerAccountId)}
            // Your own, or anybody's if you run the table — a Player opening somebody else's would
            // meet a page of controls that could not save (TICKET-PLY-01, TICKET-DM-01)
            canOpen={group.isYou || isDm}
            onOpen={onOpenCharacter}
          />
        ))
      )}
    </div>
  );
}
