/**
 * `POST /api/rulesets/import` — a ruleset from a document the client already has (TICKET-IO-04)
 *
 * **It creates; it never overwrites** (v3 Req 35.1). That is the whole difference between this route
 * and the browser's Import button, which has replaced *the* configuration since v1.0 because there
 * was only ever one. RUL-01 made an Account's rulesets plural, and this is the first route that
 * needs them to be: a file arriving on a signed-in Account is a new ruleset beside the others, and
 * every existing one — including the browser's — is left exactly as it was.
 *
 * **One route serves both of the ticket's paths, deliberately.** *Import this file* and *upload this
 * browser's ruleset* differ in where the client got the bytes; the server does the same thing with
 * them, and a second route would be a second copy of the gate → shape → report → create chain to
 * keep in step. What the upload adds is the `characters` array, which the file path never sends
 * because a `Configuration` file has never carried one.
 *
 * ## Three things are deliberately replaced on the way in
 *
 * - **The ruleset's own id**, through `copyConfiguration` — the one identity that leaves the
 *   document and becomes the row's primary key. Keeping the file's would make importing the same
 *   file twice a primary-key collision rather than two rulesets, which is exactly what v3 Req 36.5's
 *   *an upload copies* forbids.
 * - **Each character's id**, for the same reason, one table down.
 * - **Each character's `configurationId`**, which is the only field that has to be *rewritten* rather
 *   than merely reminted: a character carries the id of the ruleset it was built against, and after
 *   the import that ruleset is the one this route just created. Left alone, every uploaded character
 *   would point at a ruleset that exists only in somebody's browser.
 *
 * Entity ids *inside* the document are kept, for the reason
 * [`copyConfiguration`](../../../shared/services/copyConfiguration.ts) gives: an entity id only has
 * to be unique within a document, and regenerating them would mean rewriting every id-resolved
 * formula reference.
 *
 * **The referential report is reported, not enforced** (v3 Req 35.3). A ruleset that parses but does
 * not hang together is created and handed back with its errors, which is v1.0's rule unchanged —
 * refusing it would leave the User unable to repair the file in the app.
 *
 * **Validates: v3 Req 32.1, 35.1, 35.2, 35.3, 35.5, 36.5**
 */

import { validateConfiguration } from '#shared/engine/validator';
import { uploadedCharacterErrors } from '#shared/services/characterShape';
import { copyConfiguration } from '#shared/services/copyConfiguration';
import { serializeConfiguration } from '#shared/services/importExport';
import type { RulesetImportRequest, RulesetImportResult } from '#shared/types/api';
import type { Character } from '#shared/types/character';
import type { Configuration } from '#shared/types/config';
import type { ValidationReport } from '#shared/types/validation';
import { requireAccount } from '../../auth/guards';
import { badRequest } from '../../http/appError';
import { defineHandler } from '../../http/pipeline';
import { insertRulesetWithCharacters } from '../../repositories/rulesetRepository';
import { importedDocument, toSummary } from './rulesetPayloads';

/**
 * The most Characters one upload may carry
 *
 * A bound rather than a limit anybody will meet: the browser holds one roster for one ruleset, and a
 * table of two hundred is not a table. It is here because an unbounded array in a request body is an
 * unbounded number of inserts in one transaction-less handler, and *"nobody would send that"* is not
 * something a server gets to assume about its own API.
 */
const MAX_UPLOADED_CHARACTERS = 200;

/**
 * The Characters a request asked to bring along, checked
 *
 * **Every one of them, before any of them is stored.** A partial upload — three characters in, the
 * fourth refused — would leave the Account holding a roster it did not ask for and no way to tell
 * which half arrived, so the whole array is judged first and the route only then starts writing.
 *
 * @param submitted Whatever arrived in the request body's `characters`
 * @returns The characters, now known to be readable
 * @throws {AppError} 400 when it is not an array, is too long, or holds a record this build cannot
 *   read — with the offending records named in `fields`
 */
function uploadedCharacters(submitted: unknown): Character[] {
  if (submitted === undefined) return [];

  if (!Array.isArray(submitted)) {
    throw badRequest('The characters to upload must be a list.');
  }

  if (submitted.length > MAX_UPLOADED_CHARACTERS) {
    throw badRequest(`An upload carries at most ${MAX_UPLOADED_CHARACTERS} characters.`);
  }

  const errors = submitted.flatMap((candidate, index) =>
    uploadedCharacterErrors(candidate, `characters[${index}]`)
  );

  if (errors.length > 0) {
    throw badRequest(
      'Some of those characters are not a shape this server can read, so nothing was saved.',
      { fields: errors }
    );
  }

  return submitted as Character[];
}

/**
 * The longest a name coming out of a *document* may be
 *
 * The same bound `nameFrom` puts on a request body's `name`, applied differently on purpose. A body
 * saying `name` is a **request**, and a request the server cannot honour is refused; a document's
 * name is *data the User already has*, and refusing a file at the last gate over a long title —
 * after the version, the shape and every field have passed — would be the app rejecting something
 * it exported itself. `validateConfigurationShape` imposes no cap, so the browser's Import accepts
 * one and the account path has to as well (the IO-04 review).
 */
const MAX_IMPORTED_NAME_LENGTH = 120;

/** What a fallback name says — a file whose `name` is blank still has to be findable in the list */
const UNNAMED_IMPORT = 'Imported ruleset';

/**
 * What to call a ruleset imported from a document
 *
 * Trimmed, truncated and never refused. See {@link MAX_IMPORTED_NAME_LENGTH}.
 *
 * @param name Whatever the document called itself
 * @returns A name the column will take
 */
function importedName(name: string): string {
  const trimmed = name.trim();

  if (trimmed === '') return UNNAMED_IMPORT;

  return trimmed.slice(0, MAX_IMPORTED_NAME_LENGTH);
}

/**
 * The engine's referential report on a document that has already passed the shape gate
 *
 * `validateConfiguration` walks fields rather than guarding each one, so it *throws* on anything the
 * shape gate let through. A raw `TypeError` is not something a User can act on, and it is not a
 * server bug either — it is a file this build cannot read — so it becomes the same 400 a shape
 * failure gets. `useConfigTransfer` does exactly this on the browser path.
 *
 * @param document The imported configuration
 * @returns Its reference report
 * @throws {AppError} 400 when the ruleset cannot be walked at all
 */
function referenceReport(document: Configuration): ValidationReport {
  try {
    return validateConfiguration(document);
  } catch (error) {
    throw badRequest(
      'That ruleset has the right shape but could not be read, so nothing was saved.',
      {
        fields: [error instanceof Error ? error.message : String(error)],
      }
    );
  }
}

export const importRuleset = defineHandler(async (context): Promise<RulesetImportResult> => {
  const account = requireAccount(context);
  const body = await context.json<RulesetImportRequest>();

  // Both gates before either write, so a refusal leaves the Account holding nothing new
  const imported = importedDocument(body.configuration);
  const characters = uploadedCharacters(body.characters);

  // `copyConfiguration` rather than a spread: it is the tested deep copy, so the stored document
  // shares no object with the one going back in the response — the failure that would otherwise be
  // silent until two rulesets started retuning each other
  const document = copyConfiguration(imported, { name: importedName(imported.name) });
  const report = referenceReport(document);
  const now = Date.now();

  // **One transaction**, so a failure part-way through the roster leaves the Account with neither
  // half rather than with a ruleset and some of its characters (the IO-04 review)
  const row = insertRulesetWithCharacters({
    ruleset: {
      id: document.id,
      ownerAccountId: account.id,
      name: document.name,
      schemaVersion: document.schemaVersion,
      data: serializeConfiguration(document),
      now,
    },
    // *Unseated*: built against a local ruleset, so there is no Snapshot for one to be at a table
    // against, and saying so is more honest than inventing a game to hold it
    characters: characters.map((character) => {
      // The id is fresh and `configurationId` points at what was just created — see the header
      const stored: Character = {
        ...character,
        id: crypto.randomUUID(),
        configurationId: document.id,
      };

      return {
        id: stored.id,
        ownerAccountId: account.id,
        name: stored.name,
        data: JSON.stringify(stored),
        now,
      };
    }),
  });

  return { ...toSummary(row), report, charactersCreated: characters.length };
});
