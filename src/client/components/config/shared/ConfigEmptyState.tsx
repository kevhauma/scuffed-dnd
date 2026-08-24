/**
 * Configuration Empty State
 *
 * "No X configured yet" — the card a configuration section shows in place of its list. Seven
 * panels wrote it out identically before TICKET-DX-05.
 *
 * It is a sibling of the list rather than something `ConfigPanelShell` decides, because a section
 * can have more than one list (materials has categories, items has slots *and* items) and a shell
 * that took one `isEmpty` flag could only ever speak for the first.
 *
 * **Validates: Requirements 21.4, 21.5, 21.7**
 */

import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface ConfigEmptyStateProps {
  /** What is missing and how to add it */
  message: string;
}

export function ConfigEmptyState({ message }: ConfigEmptyStateProps) {
  return (
    <Card className="p-6">
      <Text variant="body-secondary" className="text-center">
        {message}
      </Text>
    </Card>
  );
}
