/**
 * Roll History Panel
 *
 * This character's rolls for the current session, newest first (Requirement 15.5). The history is
 * session-only — it lives in `useUIStore` and is never written to storage, so it is gone on
 * reload by design.
 *
 * **Validates: Requirements 15.5, 21.1-21.5**
 */

import type { RollResult } from '../../../stores/uiStore';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface RollHistoryPanelProps {
  history: RollResult[];
  onClear: () => void;
}

export function RollHistoryPanel({ history, onClear }: RollHistoryPanelProps) {
  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <Text variant="h4" as="h2">
          Roll History
        </Text>
        {history.length > 0 && (
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <Text variant="body-small-secondary">
          No rolls this session. Rolls are not saved between visits.
        </Text>
      ) : (
        history.map((roll) => (
          <div
            key={roll.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 py-2 last:border-b-0"
          >
            <Text variant="body-small" as="span">
              {roll.rollName}
            </Text>
            <div className="flex flex-wrap items-baseline gap-2">
              <Text variant="caption" as="span">
                {roll.input} → {roll.notation}
              </Text>
              <Text variant="highlight" as="span">
                {roll.total}
              </Text>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
