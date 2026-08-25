/**
 * `/account` — what this Account is, and how to get back into it (TICKET-AUTH-02, TICKET-AUTH-03)
 *
 * The first route that is *about* the Account rather than about signing in to one, and **the
 * milestone's first protected route** (v3 Req 32.6): it is the only surface so far that asks the
 * server about *this Account*, so it is the only one listed in `protectedRoutes.ts`. Everything
 * else — every configuration panel, the creation wizard, the sheet — stays open, which is D6.
 *
 * Today it holds one card, the linked identities v3 Req 31.9 asks for. TICKET-AUTH-04's
 * active-sessions list belongs beside it.
 *
 * **Validates: v3 Req 31.9, 32.6**
 */

import { createFileRoute } from '@tanstack/react-router';
import { LinkedIdentities } from '../components/auth/LinkedIdentities';
import { RequireAccount } from '../components/auth/RequireAccount';

export const Route = createFileRoute('/account')({ component: AccountPage });

export function AccountPage() {
  return (
    <div className="px-6 py-10 sm:px-10">
      <RequireAccount>
        <LinkedIdentities />
      </RequireAccount>
    </div>
  );
}
