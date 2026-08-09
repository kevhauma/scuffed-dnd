/**
 * Formula Preview Tests
 *
 * Every number here has to come from the engine, at the same scope the saved formula will have —
 * a preview that agrees with itself but not with the sheet is worse than no preview. So these
 * assert the arithmetic against values computed by hand from the ruleset, including the two
 * spellings of one stat reading the same box, and the error cases rendering a message or a dash
 * rather than `NaN` or a confident `0`.
 *
 * **Validates: Concept 00 §5, §7; Requirements 3.1, 3.3, 16.4**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Configuration, Stat } from '../../../types/config';
import { FormulaPreview } from './FormulaPreview';

function stat(id: string, name: string, abbreviation: string, extra: Partial<Stat> = {}): Stat {
  return {
    id,
    name,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
    ...extra,
  };
}

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 2,
  stats: [stat('str-id', 'Strength', 'STR'), stat('cha-id', 'Charisma', 'CHA')],
  specialitySkills: [],
  combatSkills: [],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  constants: [
    {
      id: 'apt-const',
      name: 'apt_value',
      displayName: 'APT value',
      description: 'Speed per attack',
      value: 30,
    },
  ],
  focusStatBonusLevel: 0,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function renderPreview(formula: string) {
  return render(<FormulaPreview formula={formula} owner="stat" config={config} />);
}

/** The ladder's rows as `[level, result]` pairs, read off the rendered cells */
function ladderRows(): [string, string][] {
  const section = screen.getByText(/With every input at the same level/).parentElement;
  if (!section) throw new Error('no ladder rendered');

  return Array.from(section.querySelectorAll('div > div'))
    .map((row) => Array.from(row.querySelectorAll('span')).map((cell) => cell.textContent ?? ''))
    .filter((cells): cells is [string, string] => cells.length === 2);
}

/** The single "at these values" result */
function sampleResult(): string {
  const row = screen.getByText(/At these values|^Result$/).parentElement;
  return within(row as HTMLElement).getAllByText(/./)[1]?.textContent ?? '';
}

describe('FormulaPreview', () => {
  it('should render nothing at all for an empty formula', () => {
    const { container } = renderPreview('');

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing for whitespace, which is not a formula either', () => {
    const { container } = renderPreview('   ');

    expect(container.firstChild).toBeNull();
  });

  it('should show one sample box per referenced variable, defaulted to 10', () => {
    renderPreview('STR * 0.2 + CHA * 0.1');

    expect(screen.getByLabelText('STR')).toHaveProperty('value', '10');
    expect(screen.getByLabelText('CHA')).toHaveProperty('value', '10');
    // 10 * 0.2 + 10 * 0.1
    expect(sampleResult()).toBe('3');
  });

  it('should recompute the single result when a sample value changes', () => {
    renderPreview('STR * 0.2 + CHA * 0.1');

    fireEvent.change(screen.getByLabelText('CHA'), { target: { value: '39' } });

    // 10 * 0.2 + 39 * 0.1 = 5.9
    expect(sampleResult()).toBe('5.9');
  });

  it('should walk the nine ladder levels with every variable at that level', () => {
    renderPreview('STR * 0.2 + CHA * 0.1');

    // Every input at the level, so the row is level * 0.3
    expect(ladderRows()).toEqual([
      ['1', '0.3'],
      ['2', '0.6'],
      ['3', '0.9'],
      ['4', '1.2'],
      ['5', '1.5'],
      ['10', '3'],
      ['15', '4.5'],
      ['20', '6'],
      ['50', '15'],
    ]);
  });

  it('should leave the ladder alone when a sample value changes', () => {
    renderPreview('STR * 0.2 + CHA * 0.1');

    fireEvent.change(screen.getByLabelText('CHA'), { target: { value: '39' } });

    // The ladder answers "what shape is this formula", which the sample boxes do not change
    expect(ladderRows()[0]).toEqual(['1', '0.3']);
  });

  it('should show the validator message and no numbers for a formula that does not parse', () => {
    renderPreview('STR * * 2');

    expect(screen.queryByLabelText('STR')).toBeNull();
    expect(screen.queryByText(/With every input at the same level/)).toBeNull();
    expect(screen.getByText(/Unexpected|Expected|Invalid/i)).toBeDefined();
  });

  it('should name an undefined variable rather than pretending it is zero', () => {
    renderPreview('WIS * 2');

    expect(screen.getByText(/Undefined variable/)).toBeDefined();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('should show a constant-only formula as one result with no ladder', () => {
    renderPreview('const.apt_value * 2');

    expect(screen.getByText('Result')).toBeDefined();
    expect(screen.getByText('60')).toBeDefined();
    // Nothing to sweep — there are no inputs
    expect(screen.queryByText(/With every input at the same level/)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });

  it('should read a dotted stat reference from the same box as its bare abbreviation', () => {
    renderPreview('STR + stats.strength');

    // One stat, one box — not two that could disagree
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('STR'), { target: { value: '7' } });

    expect(sampleResult()).toBe('14');
  });

  it('should give a dotted-only reference a box of its own', () => {
    renderPreview('stats.charisma * 2');

    fireEvent.change(screen.getByLabelText('CHA'), { target: { value: '4' } });

    expect(sampleResult()).toBe('8');
  });

  it('should show a dash rather than NaN when the formula produces no number', () => {
    // Division by zero is an error value, not `Infinity` (TICKET-FORM-07)
    renderPreview('STR / 0');

    expect(sampleResult()).toBe('—');
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
