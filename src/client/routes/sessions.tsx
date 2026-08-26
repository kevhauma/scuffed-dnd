/**
 * `/sessions` — the tables this Account sits at (TICKET-GAM-02)
 *
 * **Protected**, which is the whole difference from `/rulesets` next door. That page is D6's: signed
 * out it is the browser's own ruleset and works completely without an account. A game session is
 * server-owned by definition — it is other people — so there is nothing here for a signed-out
 * visitor to see and `protectedRoutes.ts` says so.
 *
 * **Validates: v3 Req 32.6, 37.1**
 */

import { createFileRoute } from '@tanstack/react-router';
import { RequireAccount } from '../components/auth/RequireAccount';
import { SessionsPanel } from '../components/sessions/SessionsPanel';

export const Route = createFileRoute('/sessions')({ component: SessionsPage });

export function SessionsPage() {
  return (
    <RequireAccount>
      <SessionsPanel />
    </RequireAccount>
  );
}
