/**
 * Roll History Panel
 *
 * This character's rolls, newest first (Requirement 15.5).
 *
 * **Where they come from depends on where the character lives** (TICKET-ROLL-07). A local
 * character's are `useUIStore`'s in-memory list — session-only, never written to storage, gone on
 * reload by design. A character at a table reads a projection of the session's **Event log**, which
 * survives a reload and which nothing can clear, because an event is what happened and editing it
 * is editing the past. That is why `onClear` is optional: absent means *this log is not yours to
 * clear*, and a disabled button would say *not now* where the truth is *not ever*.
 *
 * **An empty log is not always *nobody has rolled*** (TICKET-DM-04). {@link RollHistoryPanelProps.notice}
 * is the caller's chance to say why, and it is written as *there is nothing here, and here is the
 * reason* rather than as a flag named after the one reader who needs it — the same discipline
 * `ConfigPanelShell` keeps about not growing a prop per caller. The one caller today is a DM reading
 * somebody else's sheet, whose log is narrowed to rolls they cannot make; a Player's empty log means
 * exactly what the ordinary wording says and passes nothing.
 *
 * **Validates: Requirements 15.5, 21.1-21.5; v3 Req 41.6**
 */

import type { RollResult } from '../../../stores/uiStore';
import { Button } from '../../ui/Button/Button';
import { Card } from '../../ui/Card/Card';
import { Text } from '../../ui/Text/Text';

export interface RollHistoryPanelProps {
  history: RollResult[];
  /** Absent for a table's log, which is the Event log and cannot be cleared — see the module note */
  onClear?: () => void;
  /**
   * Why this log is empty, when the ordinary wording would be misleading (TICKET-DM-04)
   *
   * Shown **in place of** the empty state, never beside a list: a reader with rows in front of them
   * has their answer. Absent means the ordinary wording is the honest one.
   */
  notice?: string;
}

/** *This log is yours and lives only in this tab* — which is what offering *Clear* means */
function isOwnBrowserLog(onClear: (() => void) | undefined): boolean {
  return onClear !== undefined;
}

export function RollHistoryPanel({ history, onClear, notice }: RollHistoryPanelProps) {
  // The second sentence stopped being true for half the callers in TICKET-ROLL-07 — a table's rolls
  // are Events and outlive the tab — and an empty state that promises the wrong thing is worse than
  // none. The same signal that withholds *Clear* says which is which; a caller's own `notice` wins
  // over both, because it knows something neither sentence does (TICKET-DM-04).
  const isOwnLog = isOwnBrowserLog(onClear);
  const ordinary = isOwnLog
    ? 'No rolls this session. Rolls are not saved between visits.'
    : 'No rolls at this table yet. Every roll here is kept for the whole game.';
  const emptyText = notice ?? ordinary;

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <Text variant="h4" as="h2">
          Roll History
        </Text>
        {history.length > 0 && onClear && (
          <Button variant="secondary" size="sm" onClick={onClear}>
            Clear History
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <Text variant="body-small-secondary">{emptyText}</Text>
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
