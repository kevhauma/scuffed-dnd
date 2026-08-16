/**
 * Stat Rows Field Tests
 *
 * What this component owns is the shape both per-stat editors depend on: a row for **every**
 * configured stat in the order given, the empty state when there are none, and the label↔control
 * association that lets a panel test reach a row by `getByLabelText('Strength (STR)')`.
 *
 * **Validates: Concept 03; Concept 04; Requirements 21.1-21.5**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Stat } from '../../../types';
import { Input } from '../../ui/Input/Input';
import { StatRowsField } from './StatRowsField';

function stat(overrides: Partial<Stat> & Pick<Stat, 'id' | 'name' | 'abbreviation'>): Stat {
  return {
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...overrides,
  };
}

const STATS = [
  stat({ id: 'str-id', name: 'Strength', abbreviation: 'STR', order: 0 }),
  stat({ id: 'dex-id', name: 'Dexterity', abbreviation: 'DEX', order: 1 }),
];

function renderField(availableStats: Stat[] = STATS) {
  return render(
    <StatRowsField
      title="Stat Block"
      description="What a member of this race has."
      emptyMessage="This ruleset defines no stats yet."
      availableStats={availableStats}
      idPrefix="race-stat"
      renderControl={(_stat, controlId) => <Input id={controlId} type="number" />}
    />
  );
}

describe('StatRowsField', () => {
  it('should render the title and description', () => {
    renderField();

    expect(screen.getByText('Stat Block')).toBeDefined();
    expect(screen.getByText('What a member of this race has.')).toBeDefined();
  });

  it('should render one labelled row per configured stat', () => {
    renderField();

    expect(screen.getByLabelText('Strength (STR)')).toBeDefined();
    expect(screen.getByLabelText('Dexterity (DEX)')).toBeDefined();
  });

  it('should keep the rows in the order it was given', () => {
    const { container } = renderField();

    const labels = [...container.querySelectorAll('label')].map((label) => label.textContent);
    expect(labels).toEqual(['Strength (STR)', 'Dexterity (DEX)']);
  });

  it('should bind each control to its own row label', () => {
    renderField();

    // The association is made here rather than by each caller, so a control cannot end up
    // pointing at the wrong row's label
    expect((screen.getByLabelText('Strength (STR)') as HTMLInputElement).id).toBe(
      'race-stat-str-id'
    );
    expect((screen.getByLabelText('Dexterity (DEX)') as HTMLInputElement).id).toBe(
      'race-stat-dex-id'
    );
  });

  it('should say why there is nothing to edit when the ruleset defines no stats', () => {
    renderField([]);

    expect(screen.getByText('This ruleset defines no stats yet.')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
