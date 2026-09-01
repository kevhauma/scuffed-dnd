/**
 * No Controls Notice
 *
 * The one line a surface says when the reader it is drawn for may not act on it (TICKET-DM-05).
 *
 * **Six callers on the day it was written**, which is well past the third the house rule waits for:
 * `ResourcesSection`, `StatsSection`, `SkillsSection`, `FocusSkillsSection`, `RollsSection` and
 * `SpellbookPanel` each drew `<Text variant="body-small-secondary" className="mb-3">` around their own
 * sentence. They differ in **data** and not in behaviour, which is the convention's own test for
 * pulling something out — and `fallow`'s clone detector missed all six because each copy is shorter
 * than its window, which is why the rule is a rule rather than a thing a tool catches.
 *
 * **Why it says anything at all.** An absent control is the right answer (v3 Req 42.7, 49.10) and a
 * silent gap is not: *there is no control here* has to read as a rule of the table rather than as
 * something that failed to render. `PurseSection` set that precedent at TICKET-DM-02, one card over.
 *
 * **Validates: v3 Req 42.7, 49.10; Requirements 21.1-21.5**
 */

import { Text } from '../../ui/Text/Text';

/**
 * What the two point-spending surfaces say, stated once
 *
 * `StatsSection` and `SkillsSection` were byte-identical, and they should be: since TICKET-RES-05 they
 * spend **one** pool, so a reader told two different things about the same budget would be being told
 * something false about one of them.
 */
export const POINTS_ARE_THE_PLAYERS =
  'Only the Player spends their own points — give or take the pool itself from the quick actions in ' +
  'the rail.';

export interface NoControlsNoticeProps {
  /** What this surface tells a reader who has no controls on it, and who acts instead */
  message: string;
}

export function NoControlsNotice({ message }: NoControlsNoticeProps) {
  return (
    <Text variant="body-small-secondary" className="mb-3">
      {message}
    </Text>
  );
}
