/**
 * One ruleset in the list, whichever home it lives in (TICKET-RUL-01)
 *
 * **Every row states its home** (v3 Req 36.8), and it is a prop rather than something inferred from
 * which callbacks were passed — a row that worked out where it lived from the presence of an
 * `onRename` would start lying the day a local ruleset gains one.
 *
 * The actions are optional because the two homes genuinely differ: an account ruleset can be
 * renamed and deleted through the API, and the browser's one is renamed on the config dashboard and
 * discarded through TICKET-IO-03's confirmed path. Offering a dead button on the local row would be
 * worse than offering none.
 *
 * **Validates: v3 Req 33.8, 36.8**
 */

import type { ReactNode } from 'react';
// The home a ruleset lives in is a *destination* before it is a label, so the set is declared where
// the destination is decided (`services/rulesetSync.ts`, TICKET-RUL-02) and this renders it. Two
// copies of the same two strings is exactly what the const-object rule exists to prevent.
import { RULESET_HOME, type RulesetHomeKind } from '../../services/rulesetSync';
import { Button } from '../ui/Button/Button';
import { Text } from '../ui/Text/Text';
import { accountHomeBadgeStyles, browserHomeBadgeStyles, rulesetRowStyles } from './rulesets.style';

/** What each home is called, in the words the User reads */
const HOME_LABEL: Record<RulesetHomeKind, string> = {
  [RULESET_HOME.BROWSER]: 'This browser',
  [RULESET_HOME.ACCOUNT]: 'Your account',
};

const HOME_BADGE: Record<RulesetHomeKind, string> = {
  [RULESET_HOME.BROWSER]: browserHomeBadgeStyles,
  [RULESET_HOME.ACCOUNT]: accountHomeBadgeStyles,
};

export interface RulesetCardProps {
  name: string;
  home: RulesetHomeKind;
  /**
   * When it was last saved, in epoch milliseconds
   *
   * One type, not "ISO string or number". The two homes genuinely disagree — a `Configuration`
   * carries an ISO string and a `ruleset` row carries epoch milliseconds — and `useRulesetManager`
   * settles that before anything renders. A card whose job is a name, a badge and a date is the
   * wrong place for two storage formats to meet.
   */
  updatedAt: number;
  /**
   * The link that opens it, supplied by the caller
   *
   * A `to` string would not do: TanStack Router types `<Link to>` against the generated route tree,
   * so a route only known as `string` is a type error — and defeating that would defeat the one
   * thing the generated tree is for. The caller has the literal; it passes the link.
   */
  openAction?: ReactNode;
  onRename?: () => void;
  /** Duplicate it under a new name (TICKET-RUL-03); absent for the browser's own ruleset */
  onCopy?: () => void;
  onDelete?: () => void;
}

/** A moment somebody can read, in their own locale */
function savedOn(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString();
}

export function RulesetCard({
  name,
  home,
  updatedAt,
  openAction,
  onRename,
  onCopy,
  onDelete,
}: RulesetCardProps) {
  return (
    <div className={rulesetRowStyles}>
      <div className="flex flex-col">
        <span className={HOME_BADGE[home]}>{HOME_LABEL[home]}</span>
        <Text variant="h5" as="h3">
          {name}
        </Text>
        <Text variant="caption" as="span">
          Last saved {savedOn(updatedAt)}
        </Text>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {openAction}
        {onRename && (
          <Button variant="secondary" size="sm" onClick={onRename}>
            Rename
          </Button>
        )}
        {onCopy && (
          <Button variant="secondary" size="sm" onClick={onCopy}>
            Copy
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
