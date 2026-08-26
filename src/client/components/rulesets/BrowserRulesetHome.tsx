/**
 * The ruleset this browser holds (TICKET-RUL-01)
 *
 * **The whole of local mode's entry point, and it never mentions an Account.** Signed out this is
 * the only section with anything in it, and it behaves exactly as v2.0 did (D6): one ruleset in
 * LocalStorage, opened for editing at `/config`.
 *
 * **Exactly one, deliberately.** "Start one in this browser" appears only when there is none,
 * because `initializeConfig` replaces what is there — an affordance that silently overwrote a
 * ruleset would be a data-loss bug wearing a button.
 *
 * **Validates: v3 Req 36.1, 36.8**
 */

import { RULESET_HOME } from '../../services/rulesetSync';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { RulesetCard } from './RulesetCard';
import { homeSectionStyles } from './rulesets.style';
import type { LocalRuleset } from './useRulesetManager';

export interface BrowserRulesetHomeProps {
  /** The browser's ruleset, or `null` when it holds none */
  ruleset: LocalRuleset | null;
  /** False until LocalStorage has been read — "none yet" and "not looked yet" are different */
  isLoaded: boolean;
  onCreate: () => void;
  /** Point the config store back at this browser's ruleset before the panels render it */
  onOpen: () => void;
  /**
   * Whether copying this ruleset onto an Account is on offer (TICKET-IO-04)
   *
   * False signed out, which is the whole of what an Account buys here — and false when this browser
   * holds nothing, because there would be nothing to copy.
   */
  canUpload: boolean;
  /** Open the copy-to-my-account confirmation. It asks before it does anything (v3 Req 36.3). */
  onUpload: () => void;
}

export function BrowserRulesetHome({
  ruleset,
  isLoaded,
  onCreate,
  onOpen,
  canUpload,
  onUpload,
}: BrowserRulesetHomeProps) {
  return (
    <Card className="p-6">
      <section className={homeSectionStyles}>
        <Text variant="h3" as="h2">
          This browser
        </Text>
        <Text variant="body-small-secondary" as="p">
          Stored in this browser only, with no account. It travels as an exported JSON file.
        </Text>

        {!isLoaded ? (
          <Text variant="caption" as="p">
            Checking this browser…
          </Text>
        ) : ruleset ? (
          <RulesetCard
            name={ruleset.name}
            home={RULESET_HOME.BROWSER}
            updatedAt={ruleset.updatedAt}
            openAction={
              <>
                {/*
                  A button rather than a `Link`, the same shape the account rows use and for the same
                  reason: re-pointing the store at this home can *fail* — `loadConfiguration` throws
                  on stored data this build cannot read — and a `<Link>`'s navigation happens whatever
                  its `onClick` did. That would land the User in Configuration mode editing the
                  **Account's** ruleset believing it was this browser's, with every keystroke saving
                  there. Navigating only on success is the whole point.
                */}
                <Button variant="secondary" size="sm" onClick={onOpen}>
                  Open
                </Button>
                {/*
                  Through the `openAction` slot rather than a `RulesetCard` prop named after this one
                  caller — the conventions' "extend the shell through its slot" rule. The account
                  rows have no use for it: their ruleset is already on the account.
                */}
                {canUpload && (
                  <Button variant="secondary" size="sm" onClick={onUpload}>
                    Copy to my account
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <Text variant="body" as="p">
              This browser holds no ruleset yet.
            </Text>
            <Button variant="primary" onClick={onCreate}>
              Start one in this browser
            </Button>
          </div>
        )}
      </section>
    </Card>
  );
}
