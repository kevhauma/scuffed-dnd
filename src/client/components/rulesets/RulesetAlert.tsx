/**
 * A refusal, said once and rendered the same way wherever it appears (TICKET-IO-04)
 *
 * The folder's third `role="alert"` box, which is the count the conventions name as the moment to
 * share one — `auth/AuthAlert.tsx` is the precedent, and this is deliberately *not* that component:
 * this one also lists the **failing fields** a shape refusal carries, which is what makes a refusal
 * something the User can act on rather than a sentence they can only re-read.
 *
 * Two callers, and they are the reason it exists rather than a prediction that a third will come:
 * `RulesetsPanel` shows one on the page, and `UploadToAccountDialog` shows one *inside itself* —
 * because a dialog rendering over a `fixed inset-0` blurred overlay cannot borrow the page's.
 */

import { Text } from '../ui/Text/Text';
import { alertStyles } from './rulesets.style';

export interface RulesetAlertProps {
  /** The sentence. `null` renders nothing, so a caller can pass its state straight through. */
  message: string | null;
  /** The validator's own words, one per failing field; empty for a refusal that named none */
  fields?: string[];
}

export function RulesetAlert({ message, fields = [] }: RulesetAlertProps) {
  if (!message) return null;

  return (
    <div role="alert" className={alertStyles}>
      <Text variant="error" as="p">
        {message}
      </Text>
      {fields.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {fields.map((field) => (
            <li key={field}>
              <Text variant="error" as="span">
                {field}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
