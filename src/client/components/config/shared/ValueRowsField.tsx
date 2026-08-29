/**
 * Value Rows Field
 *
 * A block of "rows the User adds, each naming something and a number": a skill's governing weights
 * (Concept 02), a material tier's stat modifiers (Concept 09), an inlay tier's stat grants
 * (TICKET-INL-01) and an item template's per-skill vector (v4 systems/11, TICKET-ITEM-01) are the
 * same shape, and had the same markup once per caller before CR-23 pulled it here.
 *
 * **What a row *targets* is the caller's, which is what TICKET-ITEM-01 changed.** It took `Stat[]`
 * while every row named a stat; an item template's vector names a **skill**, and the fourth caller
 * is what makes the stat-shaped prop a lie rather than a simplification. So the picker takes plain
 * `{ value, label }` options and the caller says what it is offering — {@link statRowOptions} is
 * here so the three stat callers still spell a stat one way.
 *
 * **The sibling of `StatRowsField`, not a replacement for it.** That one is a *dense* block — one
 * row per configured stat, no add or remove — because a race and an archetype cannot decline to
 * have an opinion about a stat that exists. These rows are *sparse and chosen*: a skill weighs the
 * two stats it weighs, and a template moves the eight skills it moves. Different shapes, two
 * components.
 *
 * The two `register` calls belong to the caller, because the field-array path is part of the
 * caller's form type and nothing here can know it. Everything around them — the header, the Add
 * button, the guidance, the empty state, the per-row `aria-label`s — is the same either way.
 *
 * **Validates: Concept 02; Concept 09; v4 systems/10, systems/11; Requirements 21.1-21.5**
 */

import type { ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import type { Stat } from '#shared/types';
import { Button } from '../../ui/Button/Button';
import { Input } from '../../ui/Input/Input';
import { Select } from '../../ui/Select/Select';
import { Text } from '../../ui/Text/Text';

/** One entry a row's picker may name — the stored id, and how a User reads it */
export interface RowOption {
  value: string;
  label: string;
}

/**
 * The ruleset's stats as picker options, spelled the one way
 *
 * Three of this component's four callers offer stats, and `Name (ABBR)` is how a stat reads
 * everywhere a modifier names one. Here rather than in each dialog so they cannot drift.
 *
 * @param stats - The stats a row may name, in the order to offer them
 * @returns One option per stat, keyed by its id
 */
export function statRowOptions(stats: Stat[]): RowOption[] {
  return stats.map((stat) => ({ value: stat.id, label: `${stat.name} (${stat.abbreviation})` }));
}

export interface ValueRowsFieldProps {
  /** What the block is called — "Governing stats", "Stat Bonuses/Penalties" */
  title: string;
  /** The Add button's label */
  addLabel: string;
  onAdd: () => void;
  /** What a row may name; empty disables adding */
  options: RowOption[];
  /** What the options are, for the picker's label — "Stat", "Skill" */
  targetLabel: string;
  /** The field array's rows, in order — only their keys are read */
  rows: { id: string }[];
  onRemove: (index: number) => void;
  /** How one row's target picker registers, given its index */
  registerTarget: (index: number) => UseFormRegisterReturn;
  /** How one row's number box registers, given its index */
  registerValue: (index: number) => UseFormRegisterReturn;
  /** What one row is called, for the target picker's label — "bonus", "weight" */
  rowNoun: string;
  /** What the number means, for its label — "Weight", "Modifier" */
  valueLabel: string;
  /** The number box's placeholder, when it wants to say more than the label does */
  valuePlaceholder?: string;
  /** The number box's step, when the values are fractional */
  valueStep?: string;
  /** Guidance and empty states — what to say differs per entity, so the caller says it */
  children?: ReactNode;
}

export function ValueRowsField({
  title,
  addLabel,
  onAdd,
  options,
  targetLabel,
  rows,
  onRemove,
  registerTarget,
  registerValue,
  rowNoun,
  valueLabel,
  valuePlaceholder,
  valueStep,
  children,
}: ValueRowsFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Text variant="body-small" className="font-semibold">
          {title}
        </Text>
        <Button
          type="button"
          variant="secondary"
          onClick={onAdd}
          disabled={options.length === 0}
          className="text-xs px-2 py-1"
        >
          {addLabel}
        </Button>
      </div>

      {children}

      {rows.map((row, index) => (
        <div key={row.id} className="flex gap-2 items-start">
          {/*
            `register`, not watch/setValue (CR-35): the archetype dialog proves the primitive takes
            it, and rhf's dirty tracking only sees a registered field. The rows repeat, so each
            control names its own row — there is no visible label to point `htmlFor` at.
          */}
          <div className="flex-1">
            <Select
              aria-label={`${targetLabel} for ${rowNoun} row ${index + 1}`}
              options={options}
              className="w-full"
              {...registerTarget(index)}
            />
          </div>
          <div className="flex-1">
            {/* The number's label carries no row noun — "Weight for weight row 2" says it twice */}
            <Input
              type="number"
              step={valueStep}
              placeholder={valuePlaceholder ?? valueLabel}
              aria-label={`${valueLabel} for row ${index + 1}`}
              className="w-full"
              {...registerValue(index)}
            />
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => onRemove(index)}
            className="text-xs px-2 py-1 mt-1"
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  );
}
