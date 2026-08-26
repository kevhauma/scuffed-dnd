/**
 * The two homes a ruleset can live in, side by side (TICKET-RUL-01)
 *
 * **Two homes, one app**
 * ([D6](../../../../docs/v3.0_backend/overview.md#d6--local-mode-stays-sign-in-gates-connected-play-only)):
 * *this browser* — the LocalStorage ruleset, present and editable signed out — and, when signed in,
 * *your account*. There is no sync between them and no background copying in either direction;
 * which one an edit saves to follows from which one is open. This hook is where that stops being a
 * decision anybody has to remember: the local half is `useConfigStore`, the account half is
 * [`useAccountRulesets`](./useAccountRulesets.ts), and **neither module imports the other's source
 * of truth**.
 *
 * **The browser still holds exactly one.** That is not a limitation this ticket forgot to lift — it
 * is what keeps local mode identical to v2.0, so a visitor who never signs in cannot tell v3.0
 * happened. `initializeConfig` therefore appears only when there is nothing to overwrite.
 *
 * **The two homes disagree about how a timestamp is stored, and it is settled here.** A
 * `Configuration` carries an ISO string; a `ruleset` row carries epoch milliseconds. Both become
 * epoch milliseconds before anything renders them, because a card whose job is a name, a badge and
 * a date should not be the place two storage formats meet.
 *
 * What is left beyond the composition is the **naming dialog**, which is shared: one dialog creates,
 * renames and copies, because all three edit the same single field.
 *
 * **Validates: v3 Req 33.1, 33.2, 36.1, 36.8**
 */

import { useNavigate } from '@tanstack/react-router';
import type { UseFormReturn } from 'react-hook-form';
import type { RulesetSummary } from '#shared/types/api';
import { useConfigStore } from '../../stores/configStore';
import { useAuth } from '../auth/useAuth';
import { useAccountRulesets } from './useAccountRulesets';
import type { PendingDelete } from './useRulesetDeletion';
import type { RulesetDialogMode, RulesetFormData } from './useRulesetDialog';
import { useRulesetDialog } from './useRulesetDialog';
import type { RulesetTransfer } from './useRulesetTransfer';
import { useRulesetTransfer } from './useRulesetTransfer';

/** The name a brand-new local ruleset is given, matching the config dashboard's own */
const DEFAULT_LOCAL_NAME = 'My Custom Game System';

/** The browser's own ruleset, reduced to what a row renders */
export interface LocalRuleset {
  name: string;
  /** Epoch milliseconds, normalised from the document's ISO string */
  updatedAt: number;
}

/** What the ruleset list surface needs */
export interface RulesetManager {
  /** The browser's own ruleset, or `null` when this browser holds none */
  localRuleset: LocalRuleset | null;
  isLocalLoaded: boolean;
  /** Start a ruleset in this browser. Offered only when there is none to overwrite. */
  createLocalRuleset: () => void;

  isSignedIn: boolean;
  /** True while the account home's answer is still unknown — neither empty nor a list */
  isAccountPending: boolean;
  accountRulesets: RulesetSummary[];
  error: string | null;

  /** What the naming dialog is doing, or `null` while it is closed */
  dialogMode: RulesetDialogMode | null;
  form: UseFormReturn<RulesetFormData>;
  openCreate: () => void;
  openRename: (ruleset: RulesetSummary) => void;
  /** Copy one, letting the User name the copy before it is created (TICKET-RUL-03) */
  openCopy: (ruleset: RulesetSummary) => void;
  closeDialog: () => void;
  save: () => void;

  remove: (ruleset: RulesetSummary) => void;
  pendingDelete: PendingDelete | null;
  confirmDelete: () => void;
  cancelDelete: () => void;

  /** Load an account ruleset into the config store, then go and edit it (TICKET-RUL-02) */
  openAccount: (ruleset: RulesetSummary) => void;
  /** Point the config store back at the browser's own ruleset before editing it */
  openLocal: () => void;

  /**
   * Putting a document on the Account — from a file, or from this browser (TICKET-IO-04)
   *
   * Composed rather than flattened into the twenty fields above it. The two homes are this hook's
   * subject; *moving something between them* is its own concern with its own dialog, its own result
   * and its own hook, the way the naming dialog and the delete confirmation already are.
   */
  transfer: RulesetTransfer;
}

/**
 * The browser's ruleset as a row renders it
 *
 * `Date.parse` of an ISO string a `Configuration` wrote. A ruleset stored before the field existed,
 * or one somebody hand-edited, parses to `NaN` — which `toLocaleString` renders as *Invalid Date*
 * rather than throwing, so it falls back to the epoch's `0` and reads as an old date. Either way
 * the row draws; neither is worth a second failure mode on a list.
 */
function toLocalRuleset(summary: { name: string; updatedAt: string } | null): LocalRuleset | null {
  if (!summary) return null;

  const parsed = Date.parse(summary.updatedAt);

  return { name: summary.name, updatedAt: Number.isNaN(parsed) ? 0 : parsed };
}

export function useRulesetManager(): RulesetManager {
  const navigate = useNavigate();
  const { isSignedIn, isPending: isAuthPending } = useAuth();
  const account = useAccountRulesets(isSignedIn);

  // **`localSummary`, not `config`.** `config` holds whichever ruleset is open, which is the
  // *account's* whenever one is; reading it here would put the account's name under a heading
  // saying "This browser". The store keeps the local summary alongside for exactly this row.
  const localSummary = useConfigStore((state) => state.localSummary);
  const isLocalLoaded = useConfigStore((state) => state.isLoaded);
  const initializeConfig = useConfigStore((state) => state.initializeConfig);
  const openAccountRuleset = useConfigStore((state) => state.openAccountRuleset);
  const openLocalRuleset = useConfigStore((state) => state.openLocalRuleset);

  const dialog = useRulesetDialog(account);
  const transfer = useRulesetTransfer({
    isSignedIn,
    // The store's answer rather than a LocalStorage probe: the summary is already here, and reading
    // the key to decide whether to draw one button would parse a 306 KB document every render
    hasLocalRuleset: localSummary !== null,
    onCreated: account.reload,
  });

  return {
    localRuleset: toLocalRuleset(localSummary),
    isLocalLoaded,
    createLocalRuleset: () => initializeConfig(DEFAULT_LOCAL_NAME),

    isSignedIn,
    isAccountPending: isAuthPending || account.isPending,
    accountRulesets: account.rulesets,
    error: account.error,

    dialogMode: dialog.mode,
    form: dialog.form,
    openCreate: dialog.openCreate,
    openRename: dialog.openRename,
    openCopy: dialog.openCopy,
    closeDialog: dialog.close,
    save: dialog.save,

    remove: account.remove,
    pendingDelete: account.pendingDelete,
    confirmDelete: account.confirmDelete,
    cancelDelete: account.cancelDelete,

    // The navigation waits for the load: opening the panels before the document lands would put
    // Configuration mode in front of whichever ruleset happened to be open a moment ago, and a
    // failed load leaves the User where they are, with the reason on screen
    openAccount: (ruleset: RulesetSummary) => {
      void openAccountRuleset(ruleset.id).then((opened) => {
        if (opened) void navigate({ to: '/config' });
      });
    },
    // Same rule for the local home: navigate only if the store really opened it. Reading
    // LocalStorage can fail, and Configuration mode reached after a failed open would be showing
    // whatever was open before — which is the *Account's* ruleset if one was
    openLocal: () => {
      if (openLocalRuleset()) void navigate({ to: '/config' });
    },

    transfer,
  };
}
