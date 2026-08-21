/**
 * Formula Preview Placements Tests
 *
 * TICKET-FORM-09 adds no preview behaviour, only placements — so these assert the thing a
 * placement can get wrong: the **owner**. A curve generator previewed at any other owner would
 * not see `key` at all.
 *
 * **One placement is gone** (TICKET-SKL-02): the speciality skill dialog had a `bonusFormula`
 * field and a preview beneath it, and a `Skill` has neither — it is weight rows, so there is no
 * user-authored formula on it to preview. FORM-09's four placements are three.
 *
 * The curve case additionally checks the preview against `regenerateCurve`'s own output, because
 * "what this generator will write into the table" is the only claim that preview makes.
 *
 * **Validates: Concept 00 §5; Requirements 4.3, 4.5, 5.4, 16.1-16.4, 16.6**
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { regenerateCurve } from '../../../engine/curveGenerator';
import type { Configuration, Curve, Stat } from '../../../types/config';

vi.mock('../../../services/storage', () => ({
  loadConfiguration: vi.fn(() => null),
  saveConfiguration: vi.fn(),
  loadCharacters: vi.fn(() => []),
  saveCharacters: vi.fn(),
  isStorageAvailable: vi.fn(() => true),
}));

import { useConfigStore } from '../../../stores/configStore';
import { CurvesConfigPanel } from '../curves/CurvesConfigPanel';
import { RollsConfigPanel } from '../rolls/RollsConfigPanel';
import { SkillsPanel } from '../skills/skill/SkillsPanel';

function stat(id: string, name: string, abbreviation: string): Stat {
  return {
    id,
    name,
    abbreviation,
    description: '',
    order: 0,
    countsTowardTotal: true,
    isResource: false,
    rounding: 'none',
  };
}

const pointBuy: Curve = {
  id: 'point-buy',
  name: 'point_buy',
  displayName: 'Point buy',
  description: '',
  keyName: 'points',
  columns: [{ id: 'main-col', name: 'main', generator: '0.75 * (key + 1)' }],
  rows: [1, 5, 10].map((key) => ({ key, values: [0] })),
  interpolation: 'step',
  outOfRange: 'error',
  lookupDirection: 'forward',
};

const config: Configuration = {
  id: 'config1',
  name: 'Test Config',
  version: '1.0',
  schemaVersion: 9,
  stats: [stat('str-id', 'Strength', 'STR'), stat('cha-id', 'Charisma', 'CHA')],
  skills: [
    {
      id: 'stl-id',
      name: 'Stealth',
      description: '',
      // Weighted on CHA, **not** STR: the roll inputs below name STR bare, so a skill sharing
      // that stat would let a missing skills-namespace box pass unnoticed (TICKET-SKL-02)
      statWeights: [{ statId: 'cha-id', weight: 1 }],
    },
  ],
  // A roll needs a ladder before the panel will offer to add one (TICKET-ROLL-05)
  diceLadders: [
    {
      id: 'ladder-id',
      name: 'Standard',
      description: '',
      dieSizes: [20, 12, 6],
      showZeroTerms: true,
      remainder: 'flat',
    },
  ],
  materials: [],
  materialCategories: [],
  items: [],
  equipmentSlots: [],
  races: [],
  currencyTiers: [],
  constants: [],
  curves: [pointBuy],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

const dialog = () => within(screen.getByRole('dialog'));

/** The preview's ladder as `[level, result]` pairs */
function ladderRows(): [string, string][] {
  return within(dialog().getByRole('table'))
    .getAllByRole('row')
    .slice(1) // the header row
    .map((row) => [
      within(row).getByRole('rowheader').textContent ?? '',
      within(row).getByRole('cell').textContent ?? '',
    ]);
}

/** The preview's single result */
function previewResult(): string {
  const row = dialog().getByText(/At these values|^Result$/).parentElement as HTMLElement;
  return within(row).getAllByText(/./)[1]?.textContent ?? '';
}

describe('FormulaPreview placements (TICKET-FORM-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConfigStore.setState({ config: structuredClone(config), isLoaded: true });
  });

  describe('the skill dialog (TICKET-SKL-02)', () => {
    it('offers no formula field, and therefore no preview', () => {
      // The standing rule in CLAUDE.md is "every User-authored formula field ships a preview".
      // A `Skill` has no such field — its arithmetic lives once, in the calculator — so the right
      // number of previews here is zero rather than one over a formula nobody writes.
      render(<SkillsPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }));

      expect(dialog().queryByPlaceholderText(/STR \+ DEX/)).toBeNull();
      expect(dialog().queryByText(/With every input at the same level/)).toBeNull();
      // What it offers instead
      expect(dialog().getByText('Governing stats')).toBeDefined();
    });
  });

  describe('the roll dialog', () => {
    it('should preview a formula naming a skill, which this owner may name', () => {
      render(<RollsConfigPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Roll' }));

      fireEvent.change(dialog().getByPlaceholderText(/stats\.dexterity/), {
        target: { value: 'STR + skills.stealth' },
      });

      expect(dialog().getByLabelText('STR')).toBeDefined();
      expect(previewResult()).toBe('20');
    });

    it('should offer a box for the stats a named skill is weighted on (TICKET-SKL-02)', () => {
      // A skill has no value of its own to put in a box, and offering none at all would preview a
      // confident 0: `calculateSkills` skips a weight whose stat is missing from `statValues`.
      // Stealth is CHA × 1 here, so previewing it alone must still surface a CHA box and a ladder.
      render(<RollsConfigPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Roll' }));

      fireEvent.change(dialog().getByPlaceholderText(/stats\.dexterity/), {
        target: { value: 'skills.stealth * 2' },
      });

      expect(dialog().getByLabelText('CHA')).toHaveProperty('value', '10');
      expect(previewResult()).toBe('20');
      // …and the ladder sweeps it rather than showing nine identical zeroes
      expect(ladderRows()[0]).toEqual(['1', '2']);
    });

    it('should say once, not nine times, what it cannot resolve', () => {
      render(<RollsConfigPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Roll' }));

      // `skills` resolves since TICKET-SKL-02, but `nope` is not a member of it
      fireEvent.change(dialog().getByPlaceholderText(/stats\.dexterity/), {
        target: { value: 'STR + skills.nope' },
      });

      expect(dialog().getByText(/Unknown member: skills\.nope/i)).toBeDefined();
      // One explanatory line instead of a ladder of identical dashes
      expect(dialog().queryByText(/With every input at the same level/)).toBeNull();
      expect(dialog().queryByText('—')).toBeNull();
    });
  });

  describe('the curve column dialog', () => {
    /** Open the column dialog for the point-buy curve's generated column */
    function openColumnDialog() {
      render(<CurvesConfigPanel />);
      fireEvent.click(screen.getByRole('button', { name: /Edit column main/i }));
    }

    it('should sweep the row key and match what regeneration would write', () => {
      openColumnDialog();

      // The generator that is already on the column
      expect(dialog().getByText(/With every input at the same level/)).toBeDefined();

      const rows = Object.fromEntries(ladderRows());
      // 0.75 * (key + 1)
      expect(rows['1']).toBe('1.5');
      expect(rows['5']).toBe('4.5');
      expect(rows['10']).toBe('8.25');

      // And the engine agrees — same formula, same context, one source of truth. Compared
      // against `regenerateCurve` itself rather than the store action, so nothing updates a
      // mounted component mid-assertion.
      const written = regenerateCurve(pointBuy, config).curve.rows.map((row) => [
        String(row.key),
        String(row.values[0]),
      ]);
      expect(Object.fromEntries(written)).toMatchObject({
        '1': '1.5',
        '5': '4.5',
        '10': '8.25',
      });
    });

    it('should let the single-result box edit the key', () => {
      openColumnDialog();

      fireEvent.change(dialog().getByLabelText('KEY'), { target: { value: '3' } });

      // 0.75 * (3 + 1)
      expect(previewResult()).toBe('3');
    });
  });
});
