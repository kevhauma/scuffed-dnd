/**
 * Starting a table from a ruleset you own (TICKET-GAM-02)
 *
 * **The Snapshot is what the form is really about**, so the lead says so: creating a game copies the
 * ruleset, and that copy is what the table plays (D7). A DM who does not know that will be surprised
 * later, in the worst way — mid-campaign, wondering why their retune did nothing.
 *
 * **Signed out this is a prompt rather than a wall**, matching `AccountRulesetHome`: the absence of
 * an Account and an Account with no rulesets are drawn differently, because they are different
 * situations with different next steps. The three states live in {@link Body} for that component's
 * reason — a component that branches three ways *and* holds a form is two things.
 *
 * **Validates: v3 Req 37.1, 37.2**
 */

import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import type { RulesetSummary } from '#shared/types/api';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { FormField } from '../ui/FormField/FormField';
import { Label } from '../ui/Label/Label';
import { Select } from '../ui/Select/Select';
import { Text } from '../ui/Text/Text';
import { sectionStyles } from './sessions.style';

export interface StartSessionFormProps {
  rulesets: RulesetSummary[];
  /** Reports whether it landed, so the form clears only over a table that exists */
  onStart: (rulesetId: string, name: string) => Promise<boolean>;
}

/** A link that navigates rather than acts, so it is not dressed as a button */
const linkStyles = 'font-heading text-sm text-royal underline underline-offset-4';

/** The form itself, once there is something to start a game from */
function Form({ rulesets, onStart }: StartSessionFormProps) {
  const nameFieldId = useId();
  const rulesetFieldId = useId();

  const [name, setName] = useState('');
  const [rulesetId, setRulesetId] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const chosen = rulesetId || rulesets[0]?.id || '';
  const canStart = chosen !== '' && name.trim() !== '' && !isBusy;

  const start = () => {
    if (!canStart) return;

    setIsBusy(true);
    void onStart(chosen, name.trim())
      .then((started) => {
        // Cleared only over a table that exists — a form that emptied itself on a refusal would
        // have thrown away what the User typed along with the reason
        if (started) setName('');
      })
      .finally(() => setIsBusy(false));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField
        label="What to call it"
        id={nameFieldId}
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="grow"
      />
      <div>
        <Label htmlFor={rulesetFieldId}>Ruleset</Label>
        <Select
          id={rulesetFieldId}
          value={chosen}
          onChange={(event) => setRulesetId(event.target.value)}
          options={rulesets.map((ruleset) => ({ value: ruleset.id, label: ruleset.name }))}
          className="mt-1"
        />
      </div>
      <Button variant="primary" disabled={!canStart} onClick={start}>
        {isBusy ? 'Starting…' : 'Start game'}
      </Button>
    </div>
  );
}

/**
 * What fills the section, given which of the two states it is in
 *
 * **There is no signed-out branch**, for the reason `SessionList`'s `Body` gives: `/sessions` is
 * protected and composes `RequireAccount`, so an in-page *sign in to run a game* was a second design
 * for a case the redirect already owns.
 */
function Body({ rulesets, onStart }: StartSessionFormProps) {
  if (rulesets.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Text variant="body" as="p">
          A game is started from a ruleset on your account, and you have none yet.
        </Text>
        <Link to="/rulesets" className={linkStyles}>
          Go to your rulesets
        </Link>
      </div>
    );
  }

  return <Form rulesets={rulesets} onStart={onStart} />;
}

export function StartSessionForm(props: StartSessionFormProps) {
  return (
    <Card className="p-6">
      <section className={sectionStyles}>
        <Text variant="h3" as="h2">
          Start a game
        </Text>
        <Text variant="body-small-secondary" as="p">
          The game takes a copy of the ruleset as it stands now and plays by that copy. Editing the
          ruleset afterwards will not change a game already running.
        </Text>

        <Body {...props} />
      </section>
    </Card>
  );
}
