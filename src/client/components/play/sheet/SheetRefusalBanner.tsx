/**
 * The server's own sentence, kept beside the state it refused to change (v3 Req 41.5)
 *
 * Nothing on the sheet has moved — a refused action is a request that landed nowhere — so this is
 * the only sign of it, and it is dismissible rather than timed: a Player who looked away should
 * still find out why their spend did not land.
 *
 * **The message is never summarised.** The engine knows which rule was broken — the budget, the fit
 * of an item, a pool nothing can price — and a client that flattened those into *that did not work*
 * would be inventing a message nobody decided on (TICKET-PLY-01).
 *
 * Split out of `CharacterSheet` alongside `SheetStatusNotice` when TICKET-DM-01's panel and log
 * pushed that component past `fallow`'s complexity threshold.
 *
 * **Validates: v3 Req 41.5; Requirements 21.1-21.5**
 */

import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface SheetRefusalBannerProps {
  /** The refusal, or null when the last action landed */
  message: string | null;
  onDismiss: () => void;
}

export function SheetRefusalBanner({ message, onDismiss }: SheetRefusalBannerProps) {
  if (message === null) return null;

  return (
    <Card className="border-crimson p-4">
      <div role="alert" className="flex items-start justify-between gap-4">
        <Text variant="error" as="p">
          {message}
        </Text>
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}
