/**
 * Formula Preview Placements Tests
 *
 * TICKET-FORM-09 adds no preview behaviour, only placements — so these assert the thing a
 * placement can get wrong: the **owner**. A speciality dialog that previewed with the combat
 * owner would quietly accept a formula the save then refuses, and a curve generator previewed at
 * any other owner would not see `key` at all.
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
import { CombatSkillsPanel } from '../skills/combat/CombatSkillsPanel';
import { SpecialitySkillsPanel } from '../skills/speciality/SpecialitySkillsPanel';

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
  schemaVersion: 3,
  stats: [stat('str-id', 'Strength', 'STR'), stat('cha-id', 'Charisma', 'CHA')],
  specialitySkills: [
    {
      id: 'stl-id',
      code: 'STL',
      name: 'Stealth',
      description: '',
      maxBaseLevel: 10,
      bonusFormula: 'STR',
    },
  ],
  combatSkills: [
    {
      id: 'mel-id',
      code: 'MEL',
      name: 'Melee',
      description: '',
      dice: { d4: 0, d6: 1, d8: 0, d10: 0, d12: 0, d20: 0 },
      bonusFormula: 'STR',
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
  focusStatBonusLevel: 0,
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

  describe('the speciality skill dialog', () => {
    it('should preview a bonus formula over the stats it may name', () => {
      render(<SpecialitySkillsPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Speciality Skill' }));

      fireEvent.change(dialog().getByPlaceholderText(/STR \+ DEX/), {
        target: { value: 'STR * 0.2 + CHA * 0.1' },
      });

      expect(dialog().getByLabelText('STR')).toHaveProperty('value', '10');
      expect(previewResult()).toBe('3');
      expect(ladderRows()[0]).toEqual(['1', '0.3']);
    });

    it('should refuse a speciality code, which this owner may not name', () => {
      render(<SpecialitySkillsPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Speciality Skill' }));

      fireEvent.change(dialog().getByPlaceholderText(/STR \+ DEX/), {
        target: { value: 'STL * 2' },
      });

      // The owner is what makes this a mistake here and legal in the combat dialog.
      // Twice, because `FormulaEditor` reports it too — the known duplication recorded in
      // TICKET-FORM-08 implementation note 2, asserted rather than left to surprise someone.
      expect(dialog().getAllByText(/Undefined variable: STL/)).toHaveLength(2);
    });
  });

  describe('the combat skill dialog', () => {
    it('should preview a formula naming a speciality code, which this owner may name', () => {
      render(<CombatSkillsPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Combat Skill' }));

      fireEvent.change(dialog().getByPlaceholderText(/STR \+ MEL/), {
        target: { value: 'STR + STL' },
      });

      expect(dialog().getByLabelText('STL')).toBeDefined();
      expect(previewResult()).toBe('20');
    });

    it('should say once, not nine times, what it cannot resolve', () => {
      render(<CombatSkillsPanel />);
      fireEvent.click(screen.getByRole('button', { name: 'Add Combat Skill' }));

      // `skills.*` is in scope for a combat roll but has no resolver until TICKET-SKL-02
      fireEvent.change(dialog().getByPlaceholderText(/STR \+ MEL/), {
        target: { value: 'STR + skills.STL' },
      });

      expect(dialog().getByText(/Unknown namespace: skills/i)).toBeDefined();
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
