/**
 * `PUT /api/rulesets/:id` — save a ruleset's contents (TICKET-RUL-02)
 *
 * **The revision guard, and the reason it is a guard rather than a merge.** A write states what the
 * caller believed the revision was; the repository's `WHERE revision = ?` and its increment are one
 * statement, so the loser of a race updates zero rows and is told (v3 Req 33.6). Two Owners editing
 * one ruleset is
 * [out of scope for this milestone](../../../../docs/v3.0_backend/overview.md#not-in-this-milestone-deliberately)
 * — the second write is **refused**, not merged, and this is the route that makes that refusal
 * something the User meets rather than something they discover later (v3 Req 33.8).
 *
 * **The whole document goes over the wire, every save.** A patch protocol would need a second
 * representation of every entity and a merge rule, and D4 already decided the document is the unit.
 * The Ducklets corpus is 306 KB; the client's debounce is what makes that fine.
 *
 * **Nothing derived is accepted as input** (the milestone's third Definition-of-Done rule): a
 * `Configuration` is authored data throughout — formulas, weights, curve rows — and every value the
 * engine *derives* from it is derived again at read time on whichever side is asking.
 *
 * **Validates: v3 Req 32.2, 32.5, 33.4, 33.5, 33.6, 33.8, 45.1**
 */

import type { RulesetDocument, RulesetSaveRequest } from '#shared/types/api';
import { requireOwner } from '../../auth/guards';
import { badRequest, conflict, notFound } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import {
  findRuleset,
  updateRulesetData,
  WRITE_OUTCOME,
} from '../../repositories/rulesetRepository';
import { displayDocumentOf, rulesetIdFrom, storableDocument, toSummary } from './rulesetPayloads';

/** The base revision a body stated, or a refusal */
function revisionFrom(body: RulesetSaveRequest): number {
  if (!Number.isInteger(body?.revision) || body.revision < 1) {
    throw badRequest('A save must state the revision it is based on.');
  }

  return body.revision;
}

export const saveRuleset = defineHandler(async (context): Promise<RulesetDocument> => {
  const rulesetId = rulesetIdFrom(context.url);
  // The guard first, so a caller who may not touch this ruleset never gets as far as having their
  // document validated — a 404 that came *after* a field-by-field critique of the body would say
  // plenty about a resource they were not allowed to know exists
  requireOwner(context, findRuleset(rulesetId));

  const body = await context.json<RulesetSaveRequest>();
  const baseRevision = revisionFrom(body);
  const data = storableDocument(body.configuration);

  const result = updateRulesetData(rulesetId, baseRevision, data, Date.now());

  switch (result.outcome) {
    case WRITE_OUTCOME.WRITTEN:
      return { ...toSummary(result.row), configuration: displayDocumentOf(result.row) };
    case WRITE_OUTCOME.STALE:
      // The current revision rides along because a client cannot work it out and needs it to
      // offer the one thing that resolves this: reload, and re-apply
      throw conflict(
        'This ruleset changed somewhere else while you were editing it, so your last change was ' +
          'not saved. Reload it to see what it says now — nothing you typed has been thrown away.',
        { currentRevision: result.current.revision }
      );
    default:
      // Deleted between the guard's read and the write: by now it is the same fact a stranger
      // gets, and it gets the same answer (v3 Req 32.5)
      // The response is built from what the write *returned*, never from the row the guard read,
      // so a client can never adopt a revision the database did not actually store
      throw notFound();
  }
});
