/**
 * `GET /api/rulesets` — what this Account owns (TICKET-RUL-01)
 *
 * The first route that answers *about the caller* rather than about the deployment, and the one
 * that retires v1.0's standing decision that the app holds one Configuration at a time: an Account
 * holds as many as it likes. **This browser still holds exactly one**, which is what keeps local
 * mode identical to v2.0 (D6) — the `/rulesets` surface shows both homes side by side and never
 * merges them.
 *
 * **`requireAccount` is the right guard and `requireOwner` would be the wrong one.** There is no id
 * in this request to own; the listing is scoped by the caller, so ownership is the `WHERE` clause
 * rather than a check after a lookup. `routeGuards.test.ts` draws exactly that line — its detector
 * asks for a resource guard only from a handler that reads an owned identifier.
 *
 * **Validates: v3 Req 32.1, 33.1, 33.8**
 */

import type { RulesetListing } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { listRulesetsByOwner } from '../../repositories/rulesetRepository';
import { toSummary } from './rulesetPayloads';

export const listRulesets = defineHandler((context): RulesetListing => {
  const account = requireAccount(context);

  return { rulesets: listRulesetsByOwner(account.id).map(toSummary) };
});
