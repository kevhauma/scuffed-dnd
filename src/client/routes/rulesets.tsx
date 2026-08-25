/**
 * `/rulesets` — the way into Configuration mode (TICKET-RUL-01)
 *
 * **Deliberately not a protected route.** It is the surface v3 Req 36.1 is about: signed out it
 * shows the browser's own ruleset and opens it for editing, with no redirect and no sign-in wall.
 * `protectedRoutes.ts` is an allow-list and the default is open (D6), so leaving this page out of it
 * is the whole of the decision — and `protectedRoutes.test.ts` enumerates the route tree to prove
 * the open set really is everything else.
 *
 * **Validates: v3 Req 36.1, 36.8**
 */

import { createFileRoute } from '@tanstack/react-router';
import { RulesetsPanel } from '../components/rulesets/RulesetsPanel';

export const Route = createFileRoute('/rulesets')({ component: RulesetsPage });

export function RulesetsPage() {
  return <RulesetsPanel />;
}
