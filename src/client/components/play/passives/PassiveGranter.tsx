/**
 * Passive Granter
 *
 * The handout control: pick a passive the character has not been given, and give it to them (v4
 * systems/14, TICKET-PAS-01).
 *
 * **A `Select` rather than `SpellLearner`'s search box**, and the difference is the size of the two
 * catalogs. A compendium of 418 spells is something a Player already has a name in mind for, so that
 * control searches and states its match cap; a catalog of **26 passives** is a list somebody wants to
 * *read* — a DM handing out resistances is choosing among them, not looking one up. Copying the
 * search would have been machinery narrowing a list that fits on screen.
 *
 * **It offers only what the character has not got.** `grantablePassives` is the catalog's complement
 * of the held list, derived, so granting one takes it out of this picker and puts it in the list
 * above with neither control saying so.
 *
 * The `Select` keeps its disabled placeholder and resets to it after each grant, because handing out
 * two abilities in a row is the ordinary case and a picker still showing the last one invites a
 * duplicate the Kernel would refuse.
 *
 * **Validates: v4 systems/14; Requirements 21.1-21.5**
 */

import { useId, useState } from 'react';
import type { Passive } from '#shared/types/config';
import { Button } from '../../ui/Button/Button';
import { Label } from '../../ui/Label/Label';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

export interface PassiveGranterProps {
  /** Everything in the catalog this character has not been handed, in catalog order */
  grantable: Passive[];
  onGrant: (passiveId: string) => void;
}

/** The `Select` value standing for "nothing chosen" */
const NOTHING = '';

export function PassiveGranter({ grantable, onGrant }: PassiveGranterProps) {
  const selectId = useId();
  const [chosen, setChosen] = useState(NOTHING);

  if (grantable.length === 0) {
    return (
      <Text variant="body-small-secondary">
        Every passive in this ruleset has already been handed out.
      </Text>
    );
  }

  const handleGrant = () => {
    if (chosen === NOTHING) return;

    onGrant(chosen);
    setChosen(NOTHING);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <Label htmlFor={selectId}>Hand out a passive</Label>
        <Select
          id={selectId}
          value={chosen}
          placeholder="Choose an ability"
          options={grantable.map((passive) => ({ value: passive.id, label: passive.name }))}
          onChange={(event) => setChosen(event.target.value)}
          className="mt-1 w-full"
        />
      </div>

      <Button variant="primary" size="sm" disabled={chosen === NOTHING} onClick={handleGrant}>
        Grant
      </Button>
    </div>
  );
}
