/**
 * Focus Skills Section Tests
 *
 * The section had no tests of its own before TICKET-DM-05 — `CharacterSheet.test.tsx` drove the
 * picker end to end, which is where a *pick* belongs. What is new is a second rendering: with no
 * handler, the three slots read as text rather than as dropdowns whose writes the server refuses.
 *
 * Pure props, so no store and no mock.
 *
 * **Validates: Requirements 21.1-21.5; v3 Req 42.7, 49.10; v4 systems/06 gap 2**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FocusSkillsSection } from './FocusSkillsSection';
import type { FocusSlotView, SkillBreakdown } from './useCharacterSheet';

/**
 * A skill as the picker's option list holds one
 *
 * @param name - The skill's name, doubling as its id
 * @returns A complete `SkillBreakdown`
 */
function skill(name: string): SkillBreakdown {
  return {
    id: name,
    name,
    invested: 0,
    bonus: { value: 1, error: null },
    total: { value: 5, error: null },
    statContributions: [],
  };
}

/** Stealth picked in the first slot, the second left empty */
const SLOTS: FocusSlotView[] = [
  { skillId: 'Stealth', multiplier: 3.3 },
  { skillId: '', multiplier: null },
];

const SKILLS = [skill('Stealth'), skill('Arcane')];

describe('FocusSkillsSection', () => {
  it('should give a Player a picker per slot', () => {
    const onSelectFocusSkill = vi.fn();
    render(
      <FocusSkillsSection
        skills={SKILLS}
        slots={SLOTS}
        isDialled
        onSelectFocusSkill={onSelectFocusSkill}
      />
    );

    const first = screen.getByLabelText('Focus 1');
    const second = screen.getByLabelText('Focus 2');

    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });

  describe('with no picker handler, which is the table’s DM (TICKET-DM-05)', () => {
    it('should draw no dropdown for any slot', () => {
      render(<FocusSkillsSection skills={SKILLS} slots={SLOTS} isDialled />);

      const labelled = screen.queryByLabelText('Focus 1');
      const dropdowns = screen.queryAllByRole('combobox');

      expect(labelled).toBeNull();
      expect(dropdowns).toHaveLength(0);
    });

    it('should still name each slot and what it holds', () => {
      render(<FocusSkillsSection skills={SKILLS} slots={SLOTS} isDialled />);

      const first = screen.getByText('Focus 1');
      const pick = screen.getByText('Stealth');
      const second = screen.getByText('Focus 2');

      expect(first).toBeDefined();
      expect(pick).toBeDefined();
      expect(second).toBeDefined();
    });

    it('should read an unfilled slot as the same phrase the dropdown clears to', () => {
      // `No focus` is the empty option's label, so the reading and the control agree about what an
      // untouched slot is — two spellings would read as two different states
      render(<FocusSkillsSection skills={SKILLS} slots={SLOTS} isDialled />);

      const empty = screen.getByText('No focus');

      expect(empty).toBeDefined();
    });

    it('should still show what a filled slot multiplies by', () => {
      // The whole of the mechanic, and the reason a DM reads this section at all: the multiplier is
      // the engine's, and it survives the picker going
      render(<FocusSkillsSection skills={SKILLS} slots={SLOTS} isDialled />);

      const multiplier = screen.getByText('× 3.3');

      expect(multiplier).toBeDefined();
    });

    it('should say whose choice it is instead', () => {
      render(<FocusSkillsSection skills={SKILLS} slots={SLOTS} isDialled />);

      const notice = screen.getByText(/Only the Player chooses/);

      expect(notice).toBeDefined();
    });

    it('should still tell a ruleset with no skills at all', () => {
      render(<FocusSkillsSection skills={[]} slots={SLOTS} isDialled />);

      const empty = screen.getByText('This ruleset defines no skills.');

      expect(empty).toBeDefined();
    });
  });
});
