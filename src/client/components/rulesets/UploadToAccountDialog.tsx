/**
 * "Put this browser's ruleset on my account" (TICKET-IO-04)
 *
 * D6's bridge, as a question rather than a button. Three things it insists on, each because the
 * ticket says so and each visible in the markup:
 *
 * - **It says what it will copy** — the ruleset by name and the characters by count — because
 *   *"upload"* on its own does not tell somebody what they are about to duplicate.
 * - **It offers the backup first** (v3 Req 36.4), the same `downloadStoredBackup` the
 *   incompatible-data notice has offered since TICKET-IO-03.
 * - **It says the browser's copy stays**, in those words. The one thing a User has to know before
 *   agreeing is that nothing is being taken away from them, and a dialog that leaves them to infer
 *   it is a dialog people cancel.
 *
 * The uploaded characters are stated as being **at no table**, rather than left to imply they joined
 * something: they were built against this browser's ruleset, and no game session exists for them to
 * be part of. TICKET-CHAR-04 is the ticket that decides whether one can later be brought into a
 * session.
 *
 * **Validates: v3 Req 36.3, 36.4, 36.5**
 */

import type { BrowserUpload } from '../../services/rulesetUpload';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { Text } from '../ui/Text/Text';
import { RulesetAlert } from './RulesetAlert';
import type { TransferFailure } from './useAccountImport';

export interface UploadToAccountDialogProps {
  /** What would be copied, or `null` while the dialog is closed */
  upload: BrowserUpload | null;
  /** True while the request is on the wire */
  isBusy: boolean;
  /**
   * Why the last attempt did not happen, shown **inside** the dialog (the IO-04 review)
   *
   * A refused copy leaves this question open, which is right — the User's decision is still theirs
   * to make. But the reason used to be rendered on the page behind it, under an opaque, blurred,
   * scroll-locked overlay, so *Copying…* flipped back to *Copy to my account* and nothing else
   * appeared. A dialog that can fail has to carry its own refusal.
   */
  failure: TransferFailure | null;
  onBackup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** How the characters going along are described — the count, and that they are at no table */
function charactersLine(count: number): string {
  if (count === 0) {
    return 'No characters in this browser were built on it, so none will be copied.';
  }

  return (
    `${count} character${count === 1 ? '' : 's'} built on it ` +
    `${count === 1 ? 'comes' : 'come'} too. They will belong to your account and sit at no table — ` +
    'they were built here, against this browser’s ruleset, rather than in a game session.'
  );
}

export function UploadToAccountDialog({
  upload,
  isBusy,
  failure,
  onBackup,
  onConfirm,
  onCancel,
}: UploadToAccountDialogProps) {
  return (
    <Dialog open={upload !== null} onClose={onCancel} title="Copy this browser's ruleset">
      {upload && (
        <div className="flex flex-col gap-4">
          <Text variant="body" as="p">
            This copies “{upload.name}” onto your account. {charactersLine(upload.characterCount)}
          </Text>
          <Text variant="body" as="p">
            <strong>The copy in this browser stays exactly where it is.</strong> Nothing is moved
            and nothing is cleared — you will have two, and editing one will not change the other.
          </Text>

          <RulesetAlert message={failure?.message ?? null} fields={failure?.fields} />

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={onBackup}>
              Download backup
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" disabled={isBusy} onClick={onConfirm}>
              {isBusy ? 'Copying…' : 'Copy to my account'}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
