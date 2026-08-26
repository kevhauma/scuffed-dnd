/**
 * The two homes a ruleset lives in, side by side (TICKET-RUL-01)
 *
 * Configuration mode's new entry point, replacing the app's implicit single configuration. It shows
 * **this browser** — the LocalStorage ruleset, present and editable signed out — and, when signed
 * in, **your account**
 * ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)).
 *
 * **Signed out, this page is the local row and a sign-in prompt.** Not a redirect, not a sign-in
 * wall, not an empty state (v3 Req 36.1) — a visitor who never signs in sees the v2.0 app plus a
 * button, and nothing about their experience degrades. `/rulesets` is deliberately absent from
 * `protectedRoutes.ts` for that reason.
 *
 * **The two homes are never merged into one list** (v3 Req 36.8). They are two sections with two
 * headings and a badge on every row, because "where does this live?" is a question with real
 * consequences — an edit persists to whichever home the ruleset came from, and there is no sync
 * between them.
 *
 * Layout and composition only; the decisions live in `useRulesetManager`.
 *
 * **Validates: v3 Req 33.1, 33.2, 33.7, 33.8, 36.1, 36.8**
 */

import { Text } from '../ui/Text/Text';
import { AccountRulesetHome } from './AccountRulesetHome';
import { BrowserRulesetHome } from './BrowserRulesetHome';
import { DeleteRulesetConfirmation } from './DeleteRulesetConfirmation';
import { RulesetAlert } from './RulesetAlert';
import { RulesetFormDialog } from './RulesetFormDialog';
import { RulesetTransferResult } from './RulesetTransferResult';
import { UnseatedCharacters } from './UnseatedCharacters';
import { UploadToAccountDialog } from './UploadToAccountDialog';
import { useRulesetManager } from './useRulesetManager';

export function RulesetsPanel() {
  const manager = useRulesetManager();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6 sm:p-10">
      <div>
        <Text variant="h1" as="h1" className="mb-2">
          Rulesets
        </Text>
        <Text variant="body-secondary" as="p">
          A ruleset lives either in this browser or on your account. Editing one saves it back where
          it came from — nothing is copied between the two on its own.
        </Text>
      </div>

      {/*
        Two alerts, not one coalesced with `??` (the IO-04 review). `useAccountRulesets`'s error
        survives until the next *write*, so a listing that failed once on page load would have
        masked every later import refusal — including the one the upload dialog is the only other
        surface for.
      */}
      <RulesetAlert message={manager.error} />

      {/*
        The transfer's own, and only while the confirmation is closed. While it is open the dialog
        carries its own copy — this one would be behind the overlay, which is the bug the review
        found.
      */}
      {!manager.transfer.pendingUpload && (
        <RulesetAlert
          message={manager.transfer.failure?.message ?? null}
          fields={manager.transfer.failure?.fields}
        />
      )}

      <RulesetTransferResult
        result={manager.transfer.result}
        onDismiss={manager.transfer.dismissResult}
      />

      <BrowserRulesetHome
        ruleset={manager.localRuleset}
        isLoaded={manager.isLocalLoaded}
        onCreate={manager.createLocalRuleset}
        onOpen={manager.openLocal}
        canUpload={manager.transfer.canUpload}
        onUpload={manager.transfer.openUpload}
      />

      <AccountRulesetHome
        isSignedIn={manager.isSignedIn}
        isPending={manager.isAccountPending}
        rulesets={manager.accountRulesets}
        onCreate={manager.openCreate}
        onImportFile={manager.transfer.importFile}
        isImporting={manager.transfer.isBusy}
        onRename={manager.openRename}
        onCopy={manager.openCopy}
        onDelete={manager.remove}
        onOpen={manager.openAccount}
      />

      {/* Under the account home, because that is what they belong to — and it renders nothing at
          all unless this Account has uploaded some (TICKET-CHAR-04) */}
      <UnseatedCharacters
        characters={manager.unseated.characters}
        isBusy={manager.unseated.isBusy}
        error={manager.unseated.error}
        onRemove={manager.removeUnseated}
      />

      <RulesetFormDialog
        mode={manager.dialogMode}
        form={manager.form}
        onClose={manager.closeDialog}
        onSave={manager.save}
      />

      <DeleteRulesetConfirmation
        pending={manager.pendingDelete}
        onConfirm={manager.confirmDelete}
        onCancel={manager.cancelDelete}
      />

      <UploadToAccountDialog
        upload={manager.transfer.pendingUpload}
        isBusy={manager.transfer.isBusy}
        failure={manager.transfer.failure}
        onBackup={manager.transfer.downloadBackup}
        onConfirm={manager.transfer.confirmUpload}
        onCancel={manager.transfer.cancelUpload}
      />
    </div>
  );
}
