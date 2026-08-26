/**
 * The rulesets on the signed-in Account (TICKET-RUL-01)
 *
 * **Signed out this is a prompt, not a wall and not an empty state** (v3 Req 36.1). "Sign in to
 * keep rulesets on your account" is a different sentence from "you have no rulesets", and the
 * difference matters to somebody who *does* have an account and has not opened it yet — so the
 * absence of an Account and an Account with nothing in it are drawn differently rather than
 * collapsed into one apologetic line.
 *
 * **One deliberate exception to the "no raw HTML controls" rule**, the same one
 * `ConfigTransferPanel` takes and for the same reason: a `<input type="file">` cannot be styled and
 * has no base-component equivalent, so it is visually hidden and driven from a `Button`. Every
 * control the User sees is still a base component.
 *
 * **Validates: v3 Req 33.1, 33.8, 35.1, 36.1, 36.8**
 */

import { Link } from '@tanstack/react-router';
import { useRef } from 'react';
import type { RulesetSummary } from '#shared/types/api';
import { RULESET_HOME } from '../../services/rulesetSync';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { Text } from '../ui/Text/Text';
import { RulesetCard } from './RulesetCard';
import { homeSectionStyles, openLinkStyles } from './rulesets.style';

export interface AccountRulesetHomeProps {
  isSignedIn: boolean;
  /** True while the answer is still unknown — neither a list nor "none" */
  isPending: boolean;
  rulesets: RulesetSummary[];
  onCreate: () => void;
  /**
   * Create one from a file the User picked (TICKET-IO-04)
   *
   * Here rather than beside the config dashboard's Import button, because the two mean different
   * things and always will: that one **replaces** this browser's ruleset, which is what import has
   * meant since v1.0 and still means signed out (v3 Req 35.0). This one **creates**, which is only
   * possible now that an Account's rulesets are plural.
   */
  onImportFile: (file: File | null) => void;
  /** True while an import or an upload is on the wire — picking a second file must not start one */
  isImporting: boolean;
  onRename: (ruleset: RulesetSummary) => void;
  /** Duplicate it under a new name (TICKET-RUL-03) */
  onCopy: (ruleset: RulesetSummary) => void;
  onDelete: (ruleset: RulesetSummary) => void;
  /** Load it into the config store and go to Configuration mode (TICKET-RUL-02) */
  onOpen: (ruleset: RulesetSummary) => void;
}

/** What fills the section, given which of the four states it is in */
function Body({
  isSignedIn,
  isPending,
  rulesets,
  onRename,
  onCopy,
  onDelete,
  onOpen,
}: Omit<AccountRulesetHomeProps, 'onCreate' | 'onImportFile' | 'isImporting'>) {
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
          // A button rather than a `Link`: opening loads the document into the store *first*, and
          // navigating before that lands would put the config panels in front of the wrong ruleset
          openAction={
            <Button variant="secondary" size="sm" onClick={() => onOpen(ruleset)}>
              Open
            </Button>
          }
          onRename={() => onRename(ruleset)}
          onCopy={() => onCopy(ruleset)}
          onDelete={() => onDelete(ruleset)}
        />
      ))}
    </>
  );
}

export function AccountRulesetHome({
  onCreate,
  onImportFile,
  isImporting,
  ...state
}: AccountRulesetHomeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="p-6">
      <section className={homeSectionStyles}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text variant="h3" as="h2">
            Your account
          </Text>
          {state.isSignedIn && (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
              >
                {isImporting ? 'Adding…' : 'Import a file'}
              </Button>
              <Button variant="primary" size="sm" onClick={onCreate}>
                New ruleset
              </Button>

              {/* Hidden on purpose — see the note at the top of this file */}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                aria-label="Ruleset file to add to your account"
                className="sr-only"
                onChange={(event) => {
                  onImportFile(event.target.files?.[0] ?? null);
                  // Clear the input so choosing the same file twice fires a change both times
                  event.target.value = '';
                }}
              />
            </div>
          )}
        </div>

        <Body {...state} />
      </section>
    </Card>
  );
}
