/**
 * Blocked Delete Dialog
 *
 * What the User sees when a delete is refused (TICKET-REF-02): the list of things still pointing
 * at the entity, and the choice to insist. It renders the list the store action returned and
 * derives nothing itself.
 *
 * "Delete anyway" is deliberately destructive-looking and spells out the consequence, because
 * forcing does not repair the references — every formula naming the entity starts reporting an
 * error instead of a number (Concept 00 §7).
 *
 * **Validates: Concept 00 §6; Requirements 2.5, 2.6**
 */

import { Button } from '../../ui/Button/Button';
import { Dialog } from '../../ui/Dialog/Dialog';
import { Text } from '../../ui/Text/Text';
import type { BlockedDelete } from './useGuardedDelete';

interface BlockedDeleteDialogProps {
  blocked: BlockedDelete | null;
  onClose: () => void;
}

export function BlockedDeleteDialog({ blocked, onClose }: BlockedDeleteDialogProps) {
  return (
    <Dialog open={blocked !== null} onClose={onClose} title="Still In Use">
      <div className="flex flex-col gap-4">
        <Text variant="body">
          {blocked ? `${blocked.label} cannot be deleted — it is referenced by:` : ''}
        </Text>

        <ul className="flex flex-col gap-1 pl-4 list-disc">
          {(blocked?.references ?? []).map((reference) => (
            <li key={`${reference.holderKind}-${reference.holderId}-${reference.field}`}>
              <Text variant="body-secondary" as="span">
                {reference.holderKind}: {reference.holderName}{' '}
                <span className="font-mono">({reference.field})</span>
              </Text>
            </li>
          ))}
        </ul>

        <Text variant="body-secondary">
          Deleting it anyway leaves those references dangling: every formula naming it will show an
          error instead of a value.
        </Text>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => blocked?.force()}>
            Delete Anyway
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
