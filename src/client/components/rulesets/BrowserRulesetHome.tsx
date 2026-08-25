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

import { Link } from '@tanstack/react-router';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { RULESET_HOME, RulesetCard } from './RulesetCard';
import { homeSectionStyles, openLinkStyles } from './rulesets.style';
import type { LocalRuleset } from './useRulesetManager';

export interface BrowserRulesetHomeProps {
  /** The browser's ruleset, or `null` when it holds none */
  ruleset: LocalRuleset | null;
  /** False until LocalStorage has been read — "none yet" and "not looked yet" are different */
  isLoaded: boolean;
  onCreate: () => void;
}

export function BrowserRulesetHome({ ruleset, isLoaded, onCreate }: BrowserRulesetHomeProps) {
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
              <Link to="/config" className={openLinkStyles}>
                Open
              </Link>
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
