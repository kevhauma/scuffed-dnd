/**
 * `/account` — what this Account is, and how to get back into it (TICKET-AUTH-02)
 *
 * The first route that is *about* the Account rather than about signing in to one. Today it holds
 * one card — the linked identities v3 Req 31.9 asks for — and it exists as a page rather than a
 * panel on `/signin` because the two answer opposite questions: one is for somebody who is not
 * signed in, this is only reachable by somebody who is. TICKET-AUTH-04's active-sessions list
 * belongs beside it.
 *
 * **It is not guarded yet, and that is TICKET-AUTH-03's job** (v3 Req 32.6, 32.7), which brings the
 * protected-route list and the return-to-destination redirect. Until then a signed-out visitor sees
 * `SignedOutNotice`, rather than a redirect this route invented on its own for AUTH-03 to unpick.
 *
 * **Validates: v3 Req 31.9**
 */

import { createFileRoute } from '@tanstack/react-router';
import { LinkedIdentities } from '../components/auth/LinkedIdentities';
import { SignedOutNotice } from '../components/auth/SignedOutNotice';
import { useAuth } from '../components/auth/useAuth';

export const Route = createFileRoute('/account')({ component: AccountPage });

export function AccountPage() {
  const { isPending, isSignedIn } = useAuth();

  // Three states, not two: rendering the signed-out card while the answer is still unknown tells
  // somebody who *is* signed in that they are not — the `useAuth` mistake, on a whole page
  if (isPending) return null;

  return (
    <div className="px-6 py-10 sm:px-10">
      {isSignedIn ? <LinkedIdentities /> : <SignedOutNotice />}
    </div>
  );
}
