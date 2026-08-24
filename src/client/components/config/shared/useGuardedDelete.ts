/**
 * Guarded Delete Hook
 *
 * The one delete flow every configuration panel uses (TICKET-REF-02). The panel says what it is
 * trying to delete and how; this holds the refusal that comes back, so the panel neither derives
 * references itself nor decides whether a delete is safe — the store action already did both.
 *
 * A blocked delete keeps the attempt around, so "Delete anyway" re-runs the *same* action with
 * `force`, against whatever the configuration looks like at that moment.
 *
 * **Validates: Concept 00 §6; Requirements 2.5, 2.6**
 */

import { useState } from 'react';
import type { EntityReference } from '#shared/engine/dependencies';
import type { DeleteOptions } from '../../../stores/configStore';

/** A delete action as the panels call it — returns what blocked it, empty when it went through */
export type GuardedDeleteAction = (options?: DeleteOptions) => EntityReference[];

/** A delete the store refused, and the way to insist */
export interface BlockedDelete {
  /** What the User tried to delete, for the dialog title — "Main Skill STR" */
  label: string;
  references: EntityReference[];
  force: () => void;
}

export interface GuardedDelete {
  blocked: BlockedDelete | null;
  attemptDelete: (label: string, action: GuardedDeleteAction) => void;
  dismissBlocked: () => void;
}

/**
 * Run deletes through the store's guard and hold on to a refusal
 *
 * @returns The blocked delete (or null), the way to attempt one, and the way to dismiss it
 */
export function useGuardedDelete(): GuardedDelete {
  const [blocked, setBlocked] = useState<BlockedDelete | null>(null);

  const attemptDelete = (label: string, action: GuardedDeleteAction) => {
    const references = action();
    if (references.length === 0) return;

    setBlocked({
      label,
      references,
      force: () => {
        action({ force: true });
        setBlocked(null);
      },
    });
  };

  return { blocked, attemptDelete, dismissBlocked: () => setBlocked(null) };
}
