/**
 * Getting a document onto the Account — from a file, or from this browser (TICKET-IO-04)
 *
 * Two entry points, one outcome: a **new** ruleset on the Account, with the engine's referential
 * report beside it. Neither replaces anything, which is the whole difference from the config
 * dashboard's Import button — that one has replaced *the* configuration since v1.0 and still does,
 * because signed out there is only ever one (D6, v3 Req 35.0).
 *
 * **The browser's ruleset is never written here.** The upload reads LocalStorage through
 * `rulesetUpload.ts` and posts what it read; both keys are byte-identical afterwards (v3 Req 36.5).
 *
 * **The backup comes first and the action needs an explicit choice** (v3 Req 36.3, 36.4). The
 * confirmation names what would be copied and offers the same `downloadStoredBackup` the
 * incompatible-data notice has offered since TICKET-IO-03 — one backup path, not a second one that
 * writes a slightly different file.
 *
 * **What is *not* here is the request**, which is [`useAccountImport`](./useAccountImport.ts), and
 * the once-per-Account offer, which is [`useUploadPrompt`](./useUploadPrompt.ts). This composes the
 * three and owns only the confirmation.
 *
 * **Validates: v3 Req 35.1, 35.3, 35.5, 36.3, 36.4, 36.5**
 */

import { useCallback, useState } from 'react';
import { downloadStoredBackup, readConfigurationDocument } from '../../services/configFiles';
import type { BrowserUpload } from '../../services/rulesetUpload';
import { readBrowserUpload } from '../../services/rulesetUpload';
import type { AccountImport, TransferFailure, TransferResult } from './useAccountImport';
import { useAccountImport } from './useAccountImport';
import { useUploadPrompt } from './useUploadPrompt';

export type { TransferFailure, TransferResult };

/** What the ruleset list needs in order to put a document on the Account */
export interface RulesetTransfer
  extends Pick<AccountImport, 'result' | 'isBusy' | 'dismissResult'> {
  /** Why the last attempt did not happen, with the failing fields when the server named them */
  failure: TransferFailure | null;

  /** Create a ruleset on the Account from a file the User picked */
  importFile: (file: File | null) => void;

  /** What an upload would copy, or `null` while the confirmation is closed */
  pendingUpload: BrowserUpload | null;
  /** True when there is something in this browser to offer uploading at all */
  canUpload: boolean;
  openUpload: () => void;
  cancelUpload: () => void;
  confirmUpload: () => void;
  /** Download the stored bytes exactly as they are, before anything is copied */
  downloadBackup: () => void;
}

/** What the hook has to be told about the page around it */
export interface RulesetTransferOptions {
  /** Whether there is an Account to put anything on */
  isSignedIn: boolean;
  /**
   * Whether this browser holds a ruleset at all
   *
   * Passed in rather than probed, and that is not a style choice: the store already knows, and
   * answering it here would mean parsing a 306 KB document out of LocalStorage on **every render**
   * to decide whether to draw one button. The bytes are read once, when the User opens the
   * confirmation.
   */
  hasLocalRuleset: boolean;
  /** Called after a ruleset is created, so the listing can reload */
  onCreated: () => void;
}

/**
 * What this browser would hand over, or nothing
 *
 * Stored data this build cannot open throws out of `readBrowserUpload`, and that is caught here into
 * *"there is nothing to upload"* rather than into an error: the app only renders at all once
 * `useAppHydration` has read the same keys successfully, so reaching this with unreadable data means
 * the User is already looking at `IncompatibleDataNotice` and does not need a second message
 * (v3 Req 36.7).
 */
function browserUpload(): BrowserUpload | null {
  try {
    return readBrowserUpload();
  } catch {
    return null;
  }
}

/** A refusal with no request behind it, in the shape a server refusal arrives in */
function localFailure(message: string): TransferFailure {
  return { message, fields: [] };
}

/**
 * Drive the two ways onto the Account
 *
 * @param options The page's answers to what this hook cannot see
 * @returns The transfer state and the actions behind it
 */
export function useRulesetTransfer({
  isSignedIn,
  hasLocalRuleset,
  onCreated,
}: RulesetTransferOptions): RulesetTransfer {
  const upload = useAccountImport(onCreated);
  const [pendingUpload, setPendingUpload] = useState<BrowserUpload | null>(null);
  /** A refusal this hook produced without asking the server — a bad file, an empty browser */
  const [localRefusal, setLocalRefusal] = useState<TransferFailure | null>(null);

  const openUpload = useCallback(() => {
    upload.reset();
    setLocalRefusal(null);

    const found = browserUpload();

    // Reachable when the stored data stopped being readable between the page rendering and the
    // click — another tab clearing it, mostly. Said out loud rather than a button that does nothing.
    if (!found) {
      setLocalRefusal(localFailure('This browser has no ruleset to upload right now.'));
      return;
    }

    setPendingUpload(found);
  }, [upload.reset]);

  const canUpload = isSignedIn && hasLocalRuleset;

  // Only offered when there is an Account *and* something to copy — see `useUploadPrompt` for why
  // spending the one prompt on an empty browser would be worse than not prompting
  useUploadPrompt(canUpload, openUpload);

  return {
    result: upload.result,
    // The local refusal wins while it is set, because it is always the more recent of the two: every
    // action clears it first
    failure: localRefusal ?? upload.failure,
    isBusy: upload.isBusy,
    dismissResult: upload.dismissResult,

    importFile: (file: File | null) => {
      // The same guard `confirmUpload` has. Without it, picking a file twice in quick succession
      // creates two rulesets from one intention (the IO-04 review)
      if (!file || upload.isBusy) return;

      upload.reset();
      setLocalRefusal(null);

      // The parse is the browser's — the bytes never leave the machine to be told they are not
      // JSON — and every *rule* about the document is the server's (v3 Req 35.2)
      void readConfigurationDocument(file)
        // No `characters`: a `Configuration` file has never carried any, and the ones in this
        // browser belong to the browser's ruleset rather than to the file being imported
        .then((configuration) => upload.send({ configuration }))
        .catch((cause: unknown) => upload.reportFailure(cause));
    },

    pendingUpload,
    canUpload,
    openUpload,
    cancelUpload: useCallback(() => setPendingUpload(null), []),
    confirmUpload: () => {
      if (!pendingUpload || upload.isBusy) return;

      // The confirmation closes only over a copy that **happened**, so a refusal leaves the question
      // in front of the User with the reason on it — which is why `send` reports rather than the
      // caller reading a `failure` that belongs to the previous render
      void upload.send(pendingUpload.request).then((landed) => {
        if (landed) setPendingUpload(null);
      });
    },
    downloadBackup: () => downloadStoredBackup(),
  };
}
