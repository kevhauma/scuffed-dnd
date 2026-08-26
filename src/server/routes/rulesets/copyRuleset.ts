/**
 * `POST /api/rulesets/:id/copy` — a ruleset to try a rebalance on (TICKET-RUL-03)
 *
 * Small, and it proves something the rest of the milestone assumes: that a `Configuration` document
 * survives being duplicated without the two copies sharing anything. TICKET-GAM-01's Snapshot is
 * the same operation with a different destination, which is why the copying itself lives in the
 * Kernel — [`copyConfiguration`](../../../shared/services/copyConfiguration.ts) — and this route is
 * a guard, a name and an insert.
 *
 * **The source is read and never written**, so a copy cannot damage the ruleset a table is playing
 * on Thursday — which is the whole reason a User reaches for this.
 *
 * **The copy starts at `revision` 1**, not at the source's. It is a different ruleset with its own
 * history, and inheriting a revision would make the first save against it state a number the
 * database never assigned to it.
 *
 * **Validates: v3 Req 32.2, 32.5, 34.1, 34.2, 34.3, 34.4**
 */

import { copyConfiguration, copyName } from '#shared/services/copyConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import type { RulesetSummary } from '#shared/types/api';
import { requireOwner } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { findRuleset, insertRuleset } from '../../repositories/rulesetRepository';
import { requiredName } from '../entityName';
import { displayDocumentOf, RULESET_SUBJECT, rulesetIdFrom, toSummary } from './rulesetPayloads';

/** What a copy request may say; a name is optional and is defaulted by the Kernel */
interface CopyRequest {
  name?: unknown;
}

/**
 * The body, or nothing
 *
 * **This route's body is genuinely optional**, unlike `createRuleset`'s — a copy with no name is a
 * complete request, and the Kernel supplies the derivative. So an absent or unreadable body is read
 * as *"no name given"* rather than refused, which is why the pipeline's own 400 is caught here and
 * nowhere else. The one thing it costs: a client that sends malformed JSON gets a copy under the
 * default name instead of being told its JSON was malformed. For a request whose entire content is
 * one optional string, that is the better failure.
 */
async function bodyOf(context: { json: <T>() => Promise<T> }): Promise<CopyRequest> {
  return context.json<CopyRequest>().catch(() => ({}) as CopyRequest);
}

export const copyRuleset = defineHandler(async (context): Promise<RulesetSummary> => {
  const rulesetId = rulesetIdFrom(context.url);
  const row = requireOwner(context, findRuleset(rulesetId));

  const body = await bodyOf(context);

  // Copied from the **display** form so the copy is a document in the same shape any other client
  // would have sent, then serialised back down — rather than duplicating the stored text, which
  // would work today and would quietly skip the boundary the moment either form gains a field
  const copy = copyConfiguration(displayDocumentOf(row), {
    // **Derived from the row's name, not the document's.** The two can differ — a ruleset stored
    // before RUL-01's rename wrote both, or one imported under a different name — and the row's is
    // the one the User just read in the list and asked to copy. Writing it into the document too
    // keeps the copy's two names in step from its first moment, which is the invariant RUL-01's
    // rename established.
    name: body.name === undefined ? copyName(row.name) : requiredName(body, RULESET_SUBJECT),
  });

  return toSummary(
    insertRuleset({
      id: copy.id,
      ownerAccountId: row.ownerAccountId,
      name: copy.name,
      schemaVersion: copy.schemaVersion,
      data: serializeConfiguration(copy),
      now: Date.now(),
    })
  );
});
