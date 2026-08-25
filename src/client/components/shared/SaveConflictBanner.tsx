/**
 * What the User sees when the **server** refused something about a ruleset (TICKET-RUL-02)
 *
 * v3 Req 33.8's visible half: *"surface a refused write as a conflict the User can resolve, never
 * as a silent loss"*. Two refusals share this banner because they share a shape — a sentence from
 * the server, and nothing the app can do about it on the User's behalf — but **not a heading**.
 * *This change was not saved* is a lie about a ruleset that could not be **opened**, where no change
 * was being saved at all, so the heading comes from `alert.kind` rather than being written once and
 * hedged.
 *
 * **The edit is still on screen after a refused save, and the heading says so.** That is the
 * difference from `StorageFailureBanner`, which sits a few lines away and looks similar: a full
 * LocalStorage means the change *could not be kept* and was rolled back, so what is on screen
 * matches what is stored.
 *
 * **The sentence comes from the server.** It knows which revision is ahead and which fields it
 * refused; the fields are listed verbatim in the validator's own words rather than reworded here.
 *
 * **Validates: v3 Req 33.8**
 */

import { RULESET_ALERT, type RulesetAlertKind, useUIStore } from '../../stores/uiStore';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { alertRowStyles, refusedFieldListStyles } from './SaveConflictBanner.style';

/** What each refusal is called, in the words the User reads */
const ALERT_HEADING: Record<RulesetAlertKind, string> = {
  [RULESET_ALERT.SAVE_REFUSED]: 'This Change Was Not Saved',
  [RULESET_ALERT.LOAD_FAILED]: 'That Ruleset Could Not Be Opened',
};

export function SaveConflictBanner() {
  const alert = useUIStore((state) => state.rulesetAlert);
  const dismiss = useUIStore((state) => state.dismissRulesetAlert);

  if (!alert) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-6">
      <Card variant="bordered" className="border-crimson">
        {/* `role="alert"`, like the storage banner: the thing the User was waiting on did not
            happen, and a screen reader should say so without being asked */}
        <div role="alert" className={alertRowStyles}>
          <div>
            <Text variant="h4" as="h2" className="mb-1">
              {ALERT_HEADING[alert.kind]}
            </Text>
            <Text variant="body-secondary" as="p">
              {alert.message}
            </Text>

            {alert.fields && alert.fields.length > 0 && (
              <ul className={refusedFieldListStyles}>
                {alert.fields.map((field) => (
                  <li key={field}>
                    <Text variant="body-small-secondary" as="span">
                      {field}
                    </Text>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
}
