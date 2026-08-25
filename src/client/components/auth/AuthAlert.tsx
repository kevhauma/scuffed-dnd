/**
 * What the server refused, said out loud (TICKET-AUTH-02)
 *
 * **Extracted on its third caller, not its second.** `AuthForm`, `SocialSignInButtons` and
 * `LinkedIdentities` each wrote the same five lines — a crimson box, `role="alert"`, one line of
 * error text — which is the count the conventions name as the moment to share rather than
 * duplicate.
 *
 * `role="alert"` is the whole reason this is a component rather than a class string: every one of
 * these messages appears *after* a submit the User is waiting on, and a screen reader that does not
 * announce it leaves them looking at an unchanged form. Sharing the styling and forgetting the role
 * is the failure this prevents.
 *
 * **It is a feature component, not a `components/ui/` primitive**, because only the auth folder has
 * ever wanted it. The day a config panel does, that is the third *area* and the argument for
 * promoting it.
 *
 * **Validates: v3 Req 30.6, 31.6**
 */

import { Text } from '../ui/Text/Text';
import { alertStyles } from './authSurfaces.style';

export interface AuthAlertProps {
  /** The refusal, or null when there is nothing to say */
  message: string | null;
}

export function AuthAlert({ message }: AuthAlertProps) {
  if (!message) return null;

  return (
    <div role="alert" className={alertStyles}>
      <Text variant="error" as="p">
        {message}
      </Text>
    </div>
  );
}
