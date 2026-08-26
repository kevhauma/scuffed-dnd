/**
 * Creating a ruleset on the Account from a document (TICKET-IO-04)
 *
 * The request half of `useRulesetTransfer`, on its own — what to send, what came back, and what to
 * say when it did not work. Split out at the IO-04 review, which was right on both counts: the
 * combined hook was a 96-line body doing four things, and `useUploadPrompt` beside it already showed
 * the shape.
 *
 * **A refusal carries its fields, not just its sentence.** The server attaches the validator's
 * per-field errors to a shape refusal (`ErrorDetails.fields`) precisely so a client can say *which
 * part of your ruleset could not be read* — the config dashboard's Import has listed them since
 * v1.0, and reading only `error.message` here would have made the account path the vaguer of the
 * two for the same file. That is what {@link TransferFailure} exists for.
 *
 * **Validates: v3 Req 35.1, 35.3, 35.5**
 */

import { useCallback, useState } from 'react';
import type { ErrorDetails, RulesetImportRequest } from '#shared/types/api';
import type { ValidationIssue, ValidationReport } from '#shared/types/validation';
import { ApiError } from '../../services/api';
import { importToAccount } from '../../services/rulesetUpload';

/** What an import or an upload produced */
export interface TransferResult {
  /** The created ruleset's name — v3 Req 35.5 asks that the result name it, not just say "done" */
  name: string;
  charactersCreated: number;
  report: ValidationReport;
  /** The report flattened in severity order, which is what `ValidationReport` renders */
  issues: ValidationIssue[];
}

/**
 * Why the last attempt did not happen
 *
 * A shape rather than a string, because a shape refusal is only actionable with the fields on it.
 * Empty for everything else — a 401, an unreachable server — where the sentence is the whole answer.
 */
export interface TransferFailure {
  message: string;
  /** The validator's own words, one per failing field; empty when the refusal had none */
  fields: string[];
}

/** What the ruleset list needs in order to send a document to the Account */
export interface AccountImport {
  /** The last import or upload, until the User dismisses it */
  result: TransferResult | null;
  /** Why the last attempt did not happen. Never set at the same time as {@link result}. */
  failure: TransferFailure | null;
  /** True while a request is on the wire — no surface may submit twice */
  isBusy: boolean;
  dismissResult: () => void;
  /** Say something went wrong without having made a request — a file that is not JSON */
  reportFailure: (cause: unknown) => void;
  /** Clear both, for a surface about to start something new */
  reset: () => void;
  /**
   * Send one
   *
   * @returns Whether it landed — which is what decides a confirmation closing. Reading the hook's
   *   `failure` instead would read the state from *before* this render, so a dialog would close over
   *   a refusal once and then stay open on the next one
   */
  send: (request: RulesetImportRequest) => Promise<boolean>;
}

/** What a refusal should be shown as, fields included. Module-private: nothing outside builds one. */
function failureOf(cause: unknown): TransferFailure {
  if (cause instanceof ApiError) {
    return { message: cause.message, fields: (cause.body as ErrorDetails | null)?.fields ?? [] };
  }

  return {
    message: cause instanceof Error ? cause.message : 'Something went wrong. Try again.',
    fields: [],
  };
}

/**
 * Drive one import
 *
 * @param onCreated Called after a ruleset is created, so the listing can reload
 * @returns The request state and the three ways to change it
 */
export function useAccountImport(onCreated: () => void): AccountImport {
  const [result, setResult] = useState<TransferResult | null>(null);
  const [failure, setFailure] = useState<TransferFailure | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = useCallback(() => {
    setResult(null);
    setFailure(null);
  }, []);

  return {
    result,
    failure,
    isBusy,
    dismissResult: useCallback(() => setResult(null), []),
    reportFailure: useCallback((cause: unknown) => setFailure(failureOf(cause)), []),
    reset,

    send: useCallback(
      async (request: RulesetImportRequest): Promise<boolean> => {
        setIsBusy(true);
        setFailure(null);

        try {
          const created = await importToAccount(request);

          setResult({
            name: created.name,
            charactersCreated: created.charactersCreated,
            report: created.report,
            // Severity order, which is the order `ValidationReport` groups them in anyway
            issues: [
              ...created.report.errors,
              ...created.report.warnings,
              ...created.report.information,
            ],
          });
          onCreated();
          return true;
        } catch (cause) {
          setFailure(failureOf(cause));
          return false;
        } finally {
          setIsBusy(false);
        }
      },
      [onCreated]
    ),
  };
}
