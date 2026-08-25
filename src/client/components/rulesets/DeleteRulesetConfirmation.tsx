/**
 * The confirmation the server asked for, in the server's own words (TICKET-RUL-01)
 *
 * A ruleset a Game_Session was created from is refused until the Owner confirms; confirming leaves
 * every one of those tables playable on the Snapshot it pinned (v3 Req 33.7,
 * [D7](../../../../docs/v3.0_backend/overview.md#d7--a-game-session-plays-against-a-pinned-snapshot)).
 *
 * **The sentence comes from the response, not from here.** The client does not know how many
 * sessions there are or what deleting would cost them — the server does, and it said so. A message
 * written here would be a second, staler account of the same rule.
 *
 * **A `Dialog`, not a card at the foot of the page.** The first draft rendered inline below both
 * home sections, so pressing Delete on the top row could put the answer off-screen — with no other
 * feedback, since a conflict deliberately bypasses the error banner. `ui/Dialog` is what every
 * other confirm in the app uses (`config/shared/BlockedDeleteDialog` is the same shape against a
 * different refusal): modal, focus-trapped, and impossible to miss.
 *
 * **Validates: v3 Req 33.7; Requirements 21.1-21.3**
 */

import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { Text } from '../ui/Text/Text';
import type { PendingDelete } from './useRulesetDeletion';

export interface DeleteRulesetConfirmationProps {
  /** The refused delete, or `null` when nothing is waiting on an answer */
  pending: PendingDelete | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteRulesetConfirmation({
  pending,
  onConfirm,
  onCancel,
}: DeleteRulesetConfirmationProps) {
  return (
    <Dialog
      open={pending !== null}
      onClose={onCancel}
      title={pending ? `Delete “${pending.name}”?` : ''}
    >
      <div className="flex flex-col gap-4">
        <Text variant="body" as="p">
          {pending?.message ?? ''}
        </Text>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete anyway
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
