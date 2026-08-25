/**
 * `PATCH /api/rulesets/:id` — rename a ruleset (TICKET-RUL-01)
 *
 * **A rename writes two things, because a ruleset's name lives in two places.** The `ruleset.name`
 * column is what the listing renders; `Configuration.name` is what an export file carries and what
 * the config panels put in their heading. Writing only the column would leave a ruleset called one
 * thing in the list and another once opened, and IO-04's export would ship the stale one.
 *
 * Writing the document means this is a document write, so it goes through the same compare-and-set
 * as RUL-02's save and bumps `revision` (v3 Req 33.6). A rename that lost that race would silently
 * discard somebody's edit — which is exactly what 33.8 forbids, so the loser gets a **conflict it
 * can act on** rather than a success it cannot trust.
 *
 * **Validates: v3 Req 32.2, 32.5, 33.2, 33.4, 33.6, 33.8**
 */

import type { RulesetSummary } from '#shared/types/api';
import { requireOwner } from '../../auth/guards';
import { conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import {
  findRuleset,
  updateRulesetName,
  WRITE_OUTCOME,
} from '../../repositories/rulesetRepository';
import { documentOf, nameFrom, rulesetIdFrom, toSummary } from './rulesetPayloads';

export const renameRuleset = defineHandler(async (context): Promise<RulesetSummary> => {
  const rulesetId = rulesetIdFrom(context.url);
  const row = requireOwner(context, findRuleset(rulesetId));
  const name = nameFrom(await context.json());

  // The document is already in stored form and stays in it — only `name` changes, so there is
  // nothing here for `toStoredConfiguration` to do and a round-trip through it would be a
  // translation this route has no reason to perform
  const document = { ...documentOf(row), name };

  const result = updateRulesetName(
    rulesetId,
    row.revision,
    name,
    JSON.stringify(document),
    Date.now()
  );

  switch (result.outcome) {
    case WRITE_OUTCOME.WRITTEN:
      return toSummary(result.row);
    case WRITE_OUTCOME.STALE:
      throw conflict(
        'Somebody saved this ruleset while you were renaming it. Reload it and rename it again — ' +
          'nothing you typed has been lost.'
      );
    default:
      // Deleted between the guard's read and the write. The same 404 a stranger gets, because by
      // now it is the same fact: there is no such ruleset (v3 Req 32.5)
      throw notFound();
  }
});
