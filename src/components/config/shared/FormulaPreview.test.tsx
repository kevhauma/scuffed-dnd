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
  schemaVersion: 9,
  stats: [stat('str-id', 'Strength', 'STR'), stat('cha-id', 'Charisma', 'CHA')],
  skills: [],
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
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function renderPreview(formula: string) {
  return render(<FormulaPreview formula={formula} owner="stat" config={config} />);
}

/** The ladder's body rows as `[level, result]` pairs */
function ladderRows(): [string, string][] {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1) // the header row
    .map((row) => [
      within(row).getByRole('rowheader').textContent ?? '',
      within(row).getByRole('cell').textContent ?? '',
    ]);
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

  it('should refuse a skill reference at the stat owner rather than vouching for it (CR-02)', () => {
    // The preview supplies skill values for any owner, so this used to show a confident number
    // for a formula the sheet then errored on every single time it computed it
    render(
      <FormulaPreview
        formula="skills.stealth + 1"
        owner="stat"
        config={{
          ...config,
          skills: [
            {
              id: 'stl-id',
              name: 'Stealth',
              description: '',
              statWeights: [{ statId: 'cha-id', weight: 1 }],
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/Namespace not available here: skills/)).toBeDefined();
    expect(screen.queryByText(/With every input at the same level/)).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
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

  describe('a reference nothing can resolve (TICKET-FORM-09)', () => {
    it('should say why once, instead of a ladder of identical dashes', () => {
      // `stats` is in scope for a stat, but `nope` is not a member of it
      renderPreview('STR + stats.nope');

      expect(screen.getByText(/Unknown member/i)).toBeDefined();
      expect(screen.queryByText(/With every input at the same level/)).toBeNull();
      expect(screen.queryByText('—')).toBeNull();
    });

    it('should keep the ladder for an error that varies with the inputs', () => {
      // Overflow is `not-evaluable`, and it is a fact about the *value*, not about the formula —
      // collapsing here would hide the levels where the formula works
      renderPreview('STR ^ STR ^ STR');

      expect(screen.getByText(/With every input at the same level/)).toBeDefined();
      const rows = Object.fromEntries(ladderRows());
      expect(rows['1']).toBe('1');
      expect(rows['2']).toBe('16');
      expect(rows['50']).toBe('—');
    });
  });
});
