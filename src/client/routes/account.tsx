/**
 * `/account` — what this Account is, and how to get back into it (TICKET-AUTH-02, TICKET-AUTH-03)
 *
 * The first route that is *about* the Account rather than about signing in to one, and **the
 * milestone's first protected route** (v3 Req 32.6): it is the only surface so far that asks the
 * server about *this Account*, so it is the only one listed in `protectedRoutes.ts`. Everything
 * else — every configuration panel, the creation wizard, the sheet — stays open, which is D6.
 *
 * Two cards: the linked identities v3 Req 31.9 asks for, and TICKET-AUTH-04's active-sessions list.
 * They belong on one page because they answer the same question from two sides — *how do I get back
 * into this account* and *who else is already in it*.
 *
 * **Validates: v3 Req 31.9, 32.6, 48.7**
 */

import { createFileRoute } from '@tanstack/react-router';
import { ActiveSessions } from '../components/auth/ActiveSessions';
import { LinkedIdentities } from '../components/auth/LinkedIdentities';
import { RequireAccount } from '../components/auth/RequireAccount';

export const Route = createFileRoute('/account')({ component: AccountPage });

export function AccountPage() {
  return (
    <div className="px-6 py-10 sm:px-10">
      <RequireAccount>
        <div className="flex flex-col gap-6">
          <LinkedIdentities />
          <ActiveSessions />
        </div>
      </RequireAccount>
    </div>
  );
}
