/**
 * What the last quick action did, and the offer to undo it (v3 Req 49.5, 49.6)
 *
 * Split out of [`QuickActionsSidebar`](./QuickActionsSidebar.tsx) by TICKET-DM-04, when the session
 * roster became the second placement of the quick actions. **Not a speculative abstraction** — it
 * takes no options and makes no decisions, and the thing it protects is a *sentence*: the caveat that
 * an undo is an inverse rather than a rewind is load-bearing wording a DM acts on, and two copies of
 * it are two chances for one to be edited.
 *
 * **The number shown is what the Event says happened, never what was asked for.** A restore of 5 that
 * clamped at the maximum reads as the points it actually put back, because `useQuickActions` builds
 * this from the adjustment the server wrote. A refusal produces no outcome at all and the surface
 * stays on the pre-action state, with the server's own sentence carried by whatever banner the
 * placement has.
 *
 * Layout and composition only.
 *
 * **Validates: v3 Req 49.5, 49.6**
 */

import { Button } from '../../ui/Button/Button';
import { Text } from '../../ui/Text/Text';

export interface QuickActionOutcomeProps {
  /** What the last accepted action did, as the Event recorded it — `null` until one lands */
  outcome: string | null;
  /** Apply the inverse, or `null` when there is nothing to undo */
  undo: (() => void) | null;
  /** True while an adjustment is on the wire */
  isBusy: boolean;
  className?: string;
}

export function QuickActionOutcome({
  outcome,
  undo,
  isBusy,
  className = '',
}: QuickActionOutcomeProps) {
  if (outcome === null) return null;

  return (
    <div className={className}>
      {/* What the Event says happened, not what was asked for: a restore that clamped reads as the
          points it actually put back (v3 Req 49.5) */}
      <Text variant="body-small" as="p">
        {outcome}
      </Text>

      {undo !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="xs" disabled={isBusy} onClick={undo}>
            Undo
          </Button>

          {/* Load-bearing, and the ticket says so: undo goes back through the same route under the
              same rules, so a pool whose maximum has fallen does not come back to where it was.
              Saying it here rather than only in a docblock is the point — the DM is the one who has
              to decide whether that matters (v3 Req 49.6). */}
          <Text variant="body-small-secondary" as="span">
            Undo applies the opposite action, not a rewind — a clamped pool does not come back.
          </Text>
        </div>
      )}
    </div>
  );
}
