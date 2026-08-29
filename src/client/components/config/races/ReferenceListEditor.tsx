/**
 * Reference List Editor
 *
 * One of the ruleset's creature reference lists — the sizes, or the creature types — as a set of
 * removable words plus a box to add another (v4 systems/14, TICKET-RACE-03).
 *
 * **The entries are the User's own words.** The source workbook spells `humaniod` and
 * `guargantian`, and nothing here corrects either: this is the vocabulary a race's type and size
 * are picked from, so a hard-coded set would make the app disagree with the ruleset it is running.
 * All this control refuses is a blank entry and an exact duplicate — a duplicate is not a second
 * choice, it is the same choice listed twice.
 *
 * A feature component: it composes `Button` / `Input` / `Label` / `Text` and owns every layout
 * class here. The half-typed word is local state, which is what a draft is — it belongs to nothing
 * outside this box and is never persisted; the list itself goes to the store, through the panel's
 * hook, on every accepted word.
 *
 * **Validates: Requirements 21.1-21.5**
 */

import { useState } from 'react';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Label } from '../../ui/Label/Label';
import { Text } from '../../ui/Text/Text';

export interface ReferenceListEditorProps {
  /** What the list is called — "Creature Sizes" */
  title: string;
  /** One line on what the words are for */
  description: string;
  /** What to show in the add box — `medium` */
  placeholder: string;
  /** Distinguishes this editor's controls from its sibling's on the same page */
  idPrefix: string;
  /** The words the ruleset currently offers, in the order it holds them */
  values: string[];
  /** The whole list as it should now stand — the caller hands it to the store action */
  onChange: (values: string[]) => void;
}

export function ReferenceListEditor({
  title,
  description,
  placeholder,
  idPrefix,
  values,
  onChange,
}: ReferenceListEditorProps) {
  const [draft, setDraft] = useState('');

  const inputId = `${idPrefix}-entry`;

  const addDraft = () => {
    const word = draft.trim();
    if (word === '' || values.includes(word)) return;

    onChange([...values, word]);
    setDraft('');
  };

  const removeAt = (index: number) => {
    const remaining = values.filter((_word, position) => position !== index);
    onChange(remaining);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{title}</Label>
      <Text variant="body-small-secondary" as="p">
        {description}
      </Text>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((word, index) => (
            <span
              key={word}
              className="flex items-center gap-1 rounded border border-stone-200 bg-parchment-100 px-2 py-1"
            >
              <Text variant="body-small">{word}</Text>
              <Button
                variant="secondary"
                size="xs"
                aria-label={`Remove ${word}`}
                onClick={() => removeAt(index)}
              >
                ×
              </Button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          value={draft}
          placeholder={placeholder}
          className="w-48"
          onChange={(event) => setDraft(event.target.value)}
          // Enter adds the word rather than submitting whatever form this sits inside
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            addDraft();
          }}
        />
        <Button variant="secondary" onClick={addDraft}>
          Add
        </Button>
      </div>
    </div>
  );
}
