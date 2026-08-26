/**
 * The characters on this Account that sit at no table (TICKET-CHAR-04)
 *
 * **This exists because they were invisible.** IO-04's upload copies the browser's roster onto the
 * Account, and until this ticket nothing anywhere listed the result: a Player who uploaded five
 * characters was told *5 characters came too* once, and then had no way to see that any of them
 * existed. v3 Req 40.7 asks that they be readable and **stated as being at no table**, which is the
 * whole content of the two sentences below the heading — *at no table* is not a defect to apologise
 * for, it is what they are.
 *
 * **On `/rulesets` rather than on `/play`.** They belong to a *ruleset* on the Account, which is what
 * this page is about, and `/play` is Play mode against whichever ruleset is open — a list there
 * would sit beside characters it has nothing to do with. It is also where the ruleset they hang off
 * is deleted, and deleting that takes them with it (`ON DELETE CASCADE`), so the two are worth
 * seeing together.
 *
 * **Absent rather than empty when there are none**, matching `PendingInvitations`: most Accounts
 * have never uploaded anything, and a permanent *no characters* panel is noise on every visit.
 *
 * **Validates: v3 Req 36.5, 40.7, 40.8**
 */

import type { CharacterDocument } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertStyles, rulesetRowStyles } from './rulesets.style';

export interface UnseatedCharactersProps {
  characters: CharacterDocument[];
  /** True while a delete is on the wire, so a row cannot be removed twice */
  isBusy: boolean;
  error: string | null;
  onRemove: (characterId: string) => void;
}

/** One character, and the one thing that can be done to it */
function CharacterRow({
  document,
  isBusy,
  onRemove,
}: { document: CharacterDocument } & Pick<UnseatedCharactersProps, 'isBusy' | 'onRemove'>) {
  return (
    <div className={rulesetRowStyles}>
      <Text variant="body" as="span">
        {document.character.name}
      </Text>

      <Button variant="danger" size="sm" disabled={isBusy} onClick={() => onRemove(document.id)}>
        Delete
      </Button>
    </div>
  );
}

export function UnseatedCharacters({
  characters,
  isBusy,
  error,
  onRemove,
}: UnseatedCharactersProps) {
  // Nothing uploaded and nothing to say about it — most Accounts are in this state forever
  if (characters.length === 0 && !error) return null;

  return (
    <Card className="p-6">
      <section className="flex flex-col gap-3">
        <Text variant="h3" as="h2">
          Characters at no table
        </Text>
        <Text variant="body-small-secondary" as="p">
          These came from this browser when you copied a ruleset onto your account. They are read
          against the ruleset they were built on rather than against a game, so they are not in any
          session — deleting that ruleset deletes them too.
        </Text>

        {error && (
          <div role="alert" className={alertStyles}>
            <Text variant="error" as="p">
              {error}
            </Text>
          </div>
        )}

        {characters.map((document) => (
          <CharacterRow key={document.id} document={document} isBusy={isBusy} onRemove={onRemove} />
        ))}
      </section>
    </Card>
  );
}
