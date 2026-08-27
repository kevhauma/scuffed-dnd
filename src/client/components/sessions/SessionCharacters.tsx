/**
 * The characters at this table, and the way to add one (TICKET-CHAR-04)
 *
 * **Every Member sees every character**, which is the server's rule rendered: a game is played out
 * loud, and a player who could not see the party's sheets would be playing a different game. Whose
 * each one is comes from the roster above rather than being repeated here — *who is at this table*
 * and *what is on it* are the lobby's question and this one's.
 *
 * **Creating one opens the wizard against this table's rules.** That is the whole of the ticket's
 * *one wizard, two destinations*: the button points `useConfigStore` at the session's pinned
 * Snapshot and sends the Player to the same four steps they would get signed out. A character built
 * there is priced by the table's rules, which stopped following the DM's ruleset when the game began
 * ([D7](../../../../docs/v3.0_backend/overview.md#d7--a-game-session-plays-against-a-pinned-snapshot)).
 *
 * **Your own character opens its sheet; somebody else's does not** (TICKET-PLY-01). The server
 * refuses a write to a character the Account does not own — `requireCharacterPlayer`, which is
 * narrower than the DM's writer guard on purpose — so a sheet full of controls that could not save
 * is not a page worth opening. Reading another player's is TICKET-DM-04's roster.
 *
 * **Validates: v3 Req 37.2, 40.4, 40.6, 41.1**
 */

import type { CharacterDocument } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertStyles, playerBadgeStyles, sectionStyles, sessionRowStyles } from './sessions.style';

export interface SessionCharactersProps {
  characters: CharacterDocument[];
  /** Which Account is reading, so its own characters can be told apart */
  accountId: string | null;
  /** False for an archived table, where the server refuses to create one */
  canCreate: boolean;
  isPending: boolean;
  /** True while this table's rules are being opened, so the button cannot be pressed twice */
  isOpening: boolean;
  error: string | null;
  onCreate: () => void;
  /** Open one of the reader's own characters — see the module note on why only their own */
  onOpen: (characterId: string) => void;
}

/** One character, named and attributed */
function CharacterRow({
  document,
  isMine,
  onOpen,
}: {
  document: CharacterDocument;
  isMine: boolean;
  onOpen: (characterId: string) => void;
}) {
  return (
    <div className={sessionRowStyles}>
      <div className="flex flex-col">
        {isMine && <span className={playerBadgeStyles}>Yours</span>}
        <Text variant="body" as="span">
          {document.character.name}
        </Text>
      </div>

      {isMine && (
        <Button variant="secondary" size="sm" onClick={() => onOpen(document.id)}>
          Open sheet
        </Button>
      )}
    </div>
  );
}

export function SessionCharacters({
  characters,
  accountId,
  canCreate,
  isPending,
  isOpening,
  error,
  onCreate,
  onOpen,
}: SessionCharactersProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h4" as="h3">
          Characters at this table
        </Text>
        <Text variant="body-small-secondary" as="p">
          A character here is built against the copy of the rules this game plays by, so it is
          priced the same way for everybody at the table.
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        {isPending ? (
          <Text variant="caption" as="p">
            Checking what is at this table…
          </Text>
        ) : (
          characters.map((document) => (
            <CharacterRow
              key={document.id}
              document={document}
              isMine={document.ownerAccountId === accountId}
              onOpen={onOpen}
            />
          ))
        )}

        {!isPending && characters.length === 0 && (
          <Text variant="body" as="p">
            Nobody has made a character here yet.
          </Text>
        )}

        {canCreate ? (
          <div className="flex items-start">
            <Button variant="primary" size="sm" disabled={isOpening} onClick={onCreate}>
              {isOpening ? 'Opening the rules…' : 'Make a character here'}
            </Button>
          </div>
        ) : (
          // The server's own answer, said before the click rather than as a 409 after it
          <Text variant="body" as="p">
            This game has been archived, so no new characters can be made in it.
          </Text>
        )}
      </section>
    </Card>
  );
}
