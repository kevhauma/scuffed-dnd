/**
 * The rulesets on the signed-in Account (TICKET-RUL-01)
 *
 * **Signed out this is a prompt, not a wall and not an empty state** (v3 Req 36.1). "Sign in to
 * keep rulesets on your account" is a different sentence from "you have no rulesets", and the
 * difference matters to somebody who *does* have an account and has not opened it yet — so the
 * absence of an Account and an Account with nothing in it are drawn differently rather than
 * collapsed into one apologetic line.
 *
 * **Validates: v3 Req 33.1, 33.8, 36.1, 36.8**
 */

import { Link } from '@tanstack/react-router';
import type { RulesetSummary } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { RULESET_HOME, RulesetCard } from './RulesetCard';
import { homeSectionStyles, openLinkStyles } from './rulesets.style';

export interface AccountRulesetHomeProps {
  isSignedIn: boolean;
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  rulesets: RulesetSummary[];
  onCreate: () => void;
  onRename: (ruleset: RulesetSummary) => void;
  onDelete: (ruleset: RulesetSummary) => void;
}

/** What fills the section, given which of the four states it is in */
function Body({
  isSignedIn,
  isPending,
  rulesets,
  onRename,
  onDelete,
}: Omit<AccountRulesetHomeProps, 'onCreate'>) {
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Text variant="body" as="p">
          Sign in to keep rulesets on your account, so you can build on one machine and carry on
          from another. Everything above keeps working without one.
        </Text>
        <Link to="/signin" className={openLinkStyles}>
          Sign in
        </Link>
      </div>
    );
  }

  if (isPending) {
    return (
      <Text variant="caption" as="p">
        Checking your account…
      </Text>
    );
  }

  if (rulesets.length === 0) {
    return (
      <Text variant="body" as="p">
        No rulesets on your account yet.
      </Text>
    );
  }

  return (
    <>
      {rulesets.map((ruleset) => (
        <RulesetCard
          key={ruleset.id}
          name={ruleset.name}
          home={RULESET_HOME.ACCOUNT}
          updatedAt={ruleset.updatedAt}
          onRename={() => onRename(ruleset)}
          onDelete={() => onDelete(ruleset)}
        />
      ))}
    </>
  );
}

export function AccountRulesetHome({ onCreate, ...state }: AccountRulesetHomeProps) {
  return (
    <Card className="p-6">
      <section className={homeSectionStyles}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text variant="h3" as="h2">
            Your account
          </Text>
          {state.isSignedIn && (
            <Button variant="primary" size="sm" onClick={onCreate}>
              New ruleset
            </Button>
          )}
        </div>

        <Body {...state} />
      </section>
    </Card>
  );
}
