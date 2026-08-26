/**
 * What an import or an upload produced (TICKET-IO-04)
 *
 * **It names the ruleset** (v3 Req 35.5). "Imported" on its own leaves the User scanning a list to
 * find out what just happened and under what name — and after an import the name came from the
 * *file*, so it is the one thing they could not have predicted.
 *
 * **The referential report is shown, and it is not a refusal.** A ruleset that parses but does not
 * hang together *was* created, with its problems listed, because that is the v1.0 rule this milestone
 * carried onto the server path: refusing it would leave the User unable to repair the file in the
 * app. So the wording distinguishes *"here is what is wrong with it"* from *"it was not imported"*,
 * which is the distinction the errors list would otherwise blur.
 *
 * Layout and composition only — `ValidationReport` is the primitive that knows how to draw issues.
 *
 * **Validates: v3 Req 35.3, 35.5**
 */

import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { ValidationReport } from '../ui/ValidationReport/ValidationReport';
import type { TransferResult } from './useAccountImport';

export interface RulesetTransferResultProps {
  /** The last import or upload, or `null` when there is nothing to report */
  result: TransferResult | null;
  onDismiss: () => void;
}

/** The sentence above the report — what landed, and whether it needs work */
function summaryOf(result: TransferResult): string {
  const characters =
    result.charactersCreated === 0
      ? ''
      : ` and ${result.charactersCreated} character${result.charactersCreated === 1 ? '' : 's'}`;

  return result.report.isValid
    ? `“${result.name}”${characters} added to your account — no issues found.`
    : `“${result.name}”${characters} added to your account. It was kept as it is; the checks below ` +
        'found problems to fix.';
}

export function RulesetTransferResult({ result, onDismiss }: RulesetTransferResultProps) {
  if (!result) return null;

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <Text variant={result.report.isValid ? 'success' : 'warning'} as="p">
          {summaryOf(result)}
        </Text>
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>

      {result.issues.length > 0 && <ValidationReport issues={result.issues} />}
    </Card>
  );
}
