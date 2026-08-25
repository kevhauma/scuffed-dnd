/**
 * The rulesets on the signed-in Account (TICKET-RUL-01)
 *
 * **One of the two homes, on its own.** `useRulesetManager` composes this with the browser's
 * LocalStorage ruleset; keeping them in separate modules is not tidiness — it is what makes it
 * checkable that the local half never reaches the network and the account half never reaches
 * LocalStorage (D6). Neither file imports the other's source of truth.
 *
 * **Nothing here runs until there is an Account.** `enabled` is false while nobody is signed in, so
 * a signed-out visitor's page issues no request at all, which `useRulesetManager.test.ts` asserts
 * with `fetch` stubbed to throw.
 *
 * Deleting lives next door in [`useRulesetDeletion`](./useRulesetDeletion.ts), because it has a
 * third answer these two do not: a confirmation the server asked for.
 *
 * **Validates: v3 Req 33.1, 33.2, 33.8**
 */

import { useCallback, useEffect, useState } from 'react';
import type { RulesetListing, RulesetSummary } from '#shared/types/api';
import { ApiError, apiRequest, apiSend } from '../../services/api';
import { type RulesetDeletion, useRulesetDeletion } from './useRulesetDeletion';

/** Where `/api/rulesets` lives — a relative path, because there is only ever one origin (D1) */
const RULESETS_PATH = '/api/rulesets';

/** What the account half of the ruleset list needs */
export interface AccountRulesetsState extends RulesetDeletion {
  rulesets: RulesetSummary[];
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  error: string | null;
  /** All three report whether the write landed, so a dialog closes only over a change that happened */
  create: (name: string) => Promise<boolean>;
  rename: (id: string, name: string) => Promise<boolean>;
  /** Duplicate one under a new name (TICKET-RUL-03). The source is left untouched. */
  copy: (id: string, name: string) => Promise<boolean>;
}

/** What a refusal should be shown as */
function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
}

/**
 * Drive the account home
 *
 * @param enabled Whether there is an Account to ask about
 * @returns The listing and the actions, all inert while `enabled` is false
 */
export function useAccountRulesets(enabled: boolean): AccountRulesetsState {
  const [rulesets, setRulesets] = useState<RulesetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRulesets((await apiRequest<RulesetListing>(RULESETS_PATH)).rulesets);
    } catch (cause) {
      setError(messageOf(cause));
      setRulesets([]);
    }
  }, []);

  useEffect(() => {
    // Signed out is not a failure and not an empty list — it is the account home not being there.
    // `null` is what lets the surface draw a sign-in prompt rather than "you own no rulesets",
    // which would be a lie told to somebody with an account they have not opened.
    if (!enabled) {
      setRulesets(null);
      return;
    }

    void load();
  }, [enabled, load]);

  /** Run a write and reload, reporting whether it landed */
  const write = useCallback(
    async (act: () => Promise<unknown>): Promise<boolean> => {
      setError(null);

      try {
        await act();
        await load();
        return true;
      } catch (cause) {
        setError(messageOf(cause));
        return false;
      }
    },
    [load]
  );

  const reportRefusal = useCallback(
    (cause: unknown | null) => setError(cause === null ? null : messageOf(cause)),
    []
  );
  const deletion = useRulesetDeletion(RULESETS_PATH, load, reportRefusal);

  return {
    ...deletion,
    rulesets: rulesets ?? [],
    isPending: enabled && rulesets === null,
    error,
    create: useCallback(
      (name: string) => write(() => apiSend(RULESETS_PATH, 'POST', { name })),
      [write]
    ),
    rename: useCallback(
      (id: string, name: string) =>
        write(() => apiSend(`${RULESETS_PATH}/${id}`, 'PATCH', { name })),
      [write]
    ),
    copy: useCallback(
      (id: string, name: string) =>
        write(() => apiSend(`${RULESETS_PATH}/${id}/copy`, 'POST', { name })),
      [write]
    ),
  };
}
