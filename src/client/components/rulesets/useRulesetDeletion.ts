/**
 * Deleting an account ruleset, including the confirmation the server asks for (TICKET-RUL-01)
 *
 * **Its own hook because it is its own conversation.** The other account actions are *do it, reload,
 * report a failure*; a delete has a third answer — the server refuses with a 409 and a sentence
 * when a Game_Session was created from the ruleset, and the **same** call with `confirm=true` goes
 * through (v3 Req 33.7). That refusal is not an error to show in a banner, it is a question to put
 * in front of the User, and keeping it here is what stopped `useAccountRulesets` growing a second
 * error path beside its first.
 *
 * The sentence the User reads is **the server's own**. The client does not know how many sessions
 * there are or what deleting would cost them; the server does, and it said so.
 *
 * **Validates: v3 Req 33.7**
 */

import { useCallback, useState } from 'react';
import { ERROR_CODE, type RulesetSummary } from '#shared/types/api';
import { ApiError, apiRequest } from '../../services/api';

/** A delete the server refused, and the sentence explaining what confirming would do */
export interface PendingDelete {
  id: string;
  name: string;
  message: string;
}

/** What a surface needs in order to offer a delete and its confirmation */
export interface RulesetDeletion {
  /** Ask to delete one. Something in the way comes back as {@link pendingDelete}. */
  remove: (ruleset: RulesetSummary) => void;
  pendingDelete: PendingDelete | null;
  confirmDelete: () => void;
  cancelDelete: () => void;
}

/**
 * Drive deleting an account ruleset
 *
 * @param path Where `/api/rulesets` lives
 * @param onDeleted Re-read the listing; the hook owns no list of its own
 * @param onRefusal What went wrong, or `null` to clear whatever was there. Called with `null` as
 *   each attempt starts, so a banner from the *last* delete cannot sit beside this one's answer,
 *   and with the cause when a refusal is not a confirmable conflict
 * @returns The action and the confirmation state
 */
export function useRulesetDeletion(
  path: string,
  onDeleted: () => Promise<void>,
  onRefusal: (cause: unknown | null) => void
): RulesetDeletion {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const destroy = useCallback(
    async (id: string, name: string, confirmed: boolean) => {
      onRefusal(null);

      try {
        await apiRequest<void>(`${path}/${id}${confirmed ? '?confirm=true' : ''}`, {
          method: 'DELETE',
        });
        setPendingDelete(null);
        await onDeleted();
      } catch (cause) {
        // A conflict is a question, not a failure — it gets the confirmation surface rather than
        // the error banner, and the User is told what confirming would do
        if (cause instanceof ApiError && cause.code === ERROR_CODE.CONFLICT) {
          setPendingDelete({ id, name, message: cause.message });
          return;
        }

        setPendingDelete(null);
        onRefusal(cause);
      }
    },
    [onDeleted, onRefusal, path]
  );

  return {
    remove: useCallback(
      (ruleset: RulesetSummary) => void destroy(ruleset.id, ruleset.name, false),
      [destroy]
    ),
    pendingDelete,
    confirmDelete: useCallback(() => {
      if (pendingDelete) void destroy(pendingDelete.id, pendingDelete.name, true);
    }, [destroy, pendingDelete]),
    cancelDelete: useCallback(() => setPendingDelete(null), []),
  };
}
