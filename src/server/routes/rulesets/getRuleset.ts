/**
 * `GET /api/rulesets/:id` — one ruleset, document and all (TICKET-RUL-02)
 *
 * **The only route that hands back a whole `Configuration`**, which is the counterpart to the
 * listing refusing to. A client opens a ruleset here and edits *this* document, so the `revision`
 * it saves against is the one it was given rather than one it inferred from a list row.
 *
 * **Display form, not stored form.** The column holds id-resolved references (TICKET-REF-01); what
 * a `Configuration` in memory holds is the ruleset's current spellings, because that is what the
 * panels render and what a formula editor has to show. The translation happens here, at the same
 * kind of boundary `storage.ts` and the export path are — the server is a third one of those, not
 * a new kind of thing.
 *
 * **Validates: v3 Req 32.2, 32.5, 33.1, 33.5**
 */

import type { RulesetDocument } from '#shared/types/api';
import { requireOwner } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { findRuleset } from '../../repositories/rulesetRepository';
import { displayDocumentOf, rulesetIdFrom, toSummary } from './rulesetPayloads';

export const getRuleset = defineHandler((context): RulesetDocument => {
  const rulesetId = rulesetIdFrom(context.url);
  const row = requireOwner(context, findRuleset(rulesetId));

  return { ...toSummary(row), configuration: displayDocumentOf(row) };
});
