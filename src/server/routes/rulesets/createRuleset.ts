/**
 * `POST /api/rulesets` — a new ruleset on the Account (TICKET-RUL-01)
 *
 * **It seeds through `createFreshConfiguration()`, the same function the browser calls**, and that
 * is the whole of v3 Req 33.3: a server-created ruleset and a browser-created one are the same
 * ruleset, seed constants, seed curves, dice ladder and four rolls alike. The function moved to
 * `#shared/services/freshConfiguration` in this ticket precisely so there could be one of it —
 * a second seeder here would agree on the day it was written and drift at the first retune.
 *
 * The document is stored in **stored form** — `serializeConfiguration` resolves every formula
 * reference to an id — which is the same boundary `storage.ts` and the export path apply
 * (TICKET-REF-01). The server is a third boundary of that kind, not a new kind.
 *
 * **Validates: v3 Req 32.1, 33.1, 33.3**
 */

import { createFreshConfiguration } from '#shared/services/freshConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import type { RulesetSummary } from '#shared/types/api';
import { requireAccount } from '../../auth/guards';
import { defineHandler } from '../../http/pipeline';
import { insertRuleset } from '../../repositories/rulesetRepository';
import { requiredName } from '../entityName';
import { RULESET_SUBJECT, toSummary } from './rulesetPayloads';

export const createRuleset = defineHandler(async (context): Promise<RulesetSummary> => {
  const account = requireAccount(context);
  const name = requiredName(await context.json(), RULESET_SUBJECT);

  const config = createFreshConfiguration(name);

  return toSummary(
    insertRuleset({
      // The row's id **is** the document's, rather than a second identity beside it. A ruleset the
      // browser exports and one the server holds are then the same thing under the same name, and
      // no surface has to decide which of two ids to show.
      id: config.id,
      ownerAccountId: account.id,
      name,
      // The document's own version, read from what the Kernel just built rather than restated —
      // bumping SUPPORTED_SCHEMA_VERSION must not leave this route claiming the old one
      schemaVersion: config.schemaVersion,
      data: serializeConfiguration(config),
      now: Date.now(),
    })
  );
});
