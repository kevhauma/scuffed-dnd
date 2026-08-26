/**
 * Putting a document on the Account: importing a file, and uploading this browser's (TICKET-IO-04)
 *
 * **D6's bridge between the two homes, and it only ever goes one way.** An upload *copies*: it reads
 * `dnd_builder_config` and `dnd_builder_characters`, sends what it read, and writes nothing back —
 * so afterwards both keys are byte-identical and local mode is exactly as it was (v3 Req 36.5). That
 * is not a promise this module keeps by being careful; it is a property of it importing only the
 * *loading* half of `storage.ts`. There is no `saveConfiguration` here to call.
 *
 * **Moving would have been the wrong shape.** Clearing LocalStorage is destroying the thing that
 * makes local mode work, on an action somebody might take to *try* having an account. The cost is
 * two divergent copies, which the ruleset list makes visible rather than reconciling (v3 Req 36.8) —
 * and resisting a "sync" affordance is the same decision seen from the other side, since a
 * bidirectional merge needs a rule for a document D4 deliberately treats as atomic.
 *
 * **A service rather than a store action, and the rule is intact.** CLAUDE.md's *persistence belongs
 * to the store action* is about **writes**: an action patches state and persists in one call so a
 * save cannot be half-forgotten. Nothing here persists anything locally, and nothing here changes
 * store state — it reads the browser's bytes and posts them. `rulesetSync.ts` is the precedent for
 * a service sitting beneath the store on the transport side.
 *
 * **Validates: v3 Req 35.1, 35.5, 36.2, 36.3, 36.5, 36.6, 36.7**
 */

import { toStoredConfiguration } from '#shared/engine/formula/references';
import type {
  RulesetImportRequest,
  RulesetImportResult,
  UploadPromptClaim,
} from '#shared/types/api';
import type { Character } from '#shared/types/character';
import { apiSend } from './api';
import { loadCharacters, loadConfiguration } from './storage';

/** Where the import route lives — a relative path, because there is only ever one origin (D1) */
const IMPORT_PATH = '/api/rulesets/import';

/** Where the once-per-Account prompt is claimed */
const UPLOAD_PROMPT_PATH = '/api/account/upload-prompt';

/** What this browser would hand over, and what the User is told before they agree to it */
export interface BrowserUpload {
  /** The stored ruleset's name — what the new account ruleset will be called */
  name: string;
  /** How many characters would go with it */
  characterCount: number;
  /** The request body, assembled and ready */
  request: RulesetImportRequest;
}

/**
 * What this browser holds, in the form a file would have carried it
 *
 * **Read through `loadConfiguration` and `loadCharacters` rather than off the keys**, which is what
 * makes v3 Req 36.7 structural: both refuse stored data this build cannot open, so an upload of it
 * is impossible rather than merely unlikely, and the refusal is the `StorageSchemaError` the
 * existing `IncompatibleDataNotice` is already built around. There is no second message.
 *
 * `toStoredConfiguration` puts the document back into **stored** form — id-resolved references —
 * because that is what an exported file holds and the server's import path is the file's path. The
 * browser keeps display form in memory; this is the same boundary `storage.ts` crosses on the way
 * out (TICKET-REF-01).
 *
 * @returns What would be uploaded, or `null` when this browser holds no ruleset at all
 * @throws {StorageSchemaError} When the stored data is in a shape this build cannot read
 */
export function readBrowserUpload(): BrowserUpload | null {
  const config = loadConfiguration();
  if (!config) return null;

  const characters = loadCharacters().filter(
    // Only the characters built against *this* ruleset. A roster left behind by a ruleset that has
    // since been replaced belongs to a configuration the Account is not being given, and uploading
    // it would attach characters to a ruleset they were never priced against.
    (character: Character) => character.configurationId === config.id
  );

  return {
    name: config.name,
    characterCount: characters.length,
    request: { configuration: toStoredConfiguration(config), characters },
  };
}

/**
 * Create a ruleset on the Account from a document
 *
 * One call for both paths, because there is one route — see
 * [`importRuleset.ts`](../../server/routes/rulesets/importRuleset.ts) for why the server treats
 * *import a file* and *upload this browser's* as the same operation.
 *
 * @param request The document, and the characters to bring with it
 * @returns The created ruleset and the engine's referential report
 * @throws {ApiError} As `apiRequest` does — a refusal, or an unreachable server
 */
export function importToAccount(request: RulesetImportRequest): Promise<RulesetImportResult> {
  return apiSend<RulesetImportResult>(IMPORT_PATH, 'POST', request);
}

/**
 * Take this Account's one unprompted offer to upload, if it has not been taken (v3 Req 36.6)
 *
 * Answers `true` to exactly one caller ever — the claim and the answer are one statement on the
 * server, so two tabs restoring the same session cannot both be told yes.
 *
 * @returns Whether this call is the one that should show the offer
 */
export async function claimUploadPrompt(): Promise<boolean> {
  const { shouldPrompt } = await apiSend<UploadPromptClaim>(UPLOAD_PROMPT_PATH, 'POST', {});

  return shouldPrompt;
}
