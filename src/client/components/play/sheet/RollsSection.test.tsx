/**
 * Rolls Section Tests
 *
 * What a Player actually sees when they roll. `CombatRoller.test.tsx` covered this before
 * TICKET-ROLL-06 reshaped the result; without these, the new `RollOutcome` shape — per-die `size`,
 * `input → notation`, no bonus — would be rendered by three components and asserted by none.
 *
 * **And the pool survives the button** (TICKET-DM-05): with no handler — the table's DM, whose roll
 * `rollDice.ts` refuses outright — the ladder moves off the button label into text, so the row still
 * says what would be thrown.
 *
 * Pure props, so no store and no mock: the section is given a group list and a result exactly as
 * `useCharacterSheet` and `useRoller` produce them.
 *
 * **Validates: Concept 08; Requirements 15.1, 15.4, 16.6, 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RollOutcome } from '#shared/types/formula';
import { RollsSection } from './RollsSection';
import type { RollGroup } from './useCharacterSheet';

/** Melee, priced at 39 — Concept 07's headline row through the `[20, 12, 6]` ladder */
const melee: RollGroup = {
  label: 'offence',
  rolls: [
    {
      id: 'mel-id',
      name: 'Melee',
      input: { value: 39, error: null },
      notation: { text: '1D20 + 1D12 + 1D6 + 1', error: null },
    },
  ],
};

const result: RollOutcome = {
  rollId: 'mel-id',
  rollName: 'Melee',
  input: 39,
  dice: [
    { size: 20, rolls: [14], total: 14 },
    { size: 12, rolls: [9], total: 9 },
    { size: 6, rolls: [2], total: 2 },
  ],
  diceTotal: 25,
  flat: 1,
  total: 26,
  notation: '1D20 + 1D12 + 1D6 + 1',
  timestamp: '2024-01-01T00:00:00.000Z',
};

/** The section with one offence roll and nothing rolled yet */
function renderSection(overrides: Partial<Parameters<typeof RollsSection>[0]> = {}) {
  const onRoll = vi.fn();
  render(
    <RollsSection
      rollGroups={[melee]}
      results={{}}
      errors={{}}
      canRoll
      onRoll={onRoll}
      {...overrides}
    />
  );
  return { onRoll };
}

describe('RollsSection', () => {
  it('should label the button with the pool rather than a bonus', () => {
    renderSection();

    // The whole ticket in one assertion: the dice are derived from the character's number
    expect(screen.getByRole('button', { name: 'Roll 1D20 + 1D12 + 1D6 + 1' })).toBeDefined();
    expect(screen.getByText('input 39')).toBeDefined();
  });

  it('should ask the hook to roll the definition by id', () => {
    const { onRoll } = renderSection();

    fireEvent.click(screen.getByRole('button', { name: /^Roll/ }));

    expect(onRoll).toHaveBeenCalledWith('mel-id');
  });

  it('should spell out the whole chain of a rolled result', () => {
    renderSection({ results: { 'mel-id': result } });

    // Input → pool, every die by **size**, then the dice total, the flat and the total
    expect(screen.getByText('input 39 → 1D20 + 1D12 + 1D6 + 1')).toBeDefined();
    expect(screen.getByText('D20: 14')).toBeDefined();
    expect(screen.getByText('D12: 9')).toBeDefined();
    expect(screen.getByText('D6: 2')).toBeDefined();
    expect(screen.getByText('dice 25 · flat 1')).toBeDefined();
    expect(screen.getByText('26')).toBeDefined();
  });

  it('should drop a rung that rolled no dice from the per-die list', () => {
    // `showZeroTerms` keeps `0D20` in the *notation*; there is nothing to print for it here
    renderSection({
      results: {
        'mel-id': { ...result, dice: [{ size: 20, rolls: [], total: 0 }, ...result.dice.slice(1)] },
      },
    });

    expect(screen.queryByText(/^D20:/)).toBeNull();
    expect(screen.getByText('D12: 9')).toBeDefined();
  });

  it('should chip a roll whose pool could not be derived, and refuse to roll it', () => {
    renderSection({
      rollGroups: [
        {
          label: 'offence',
          rolls: [
            {
              id: 'mel-id',
              name: 'Melee',
              input: { value: null, error: 'Undefined variable: STR' },
              notation: { text: null, error: 'Undefined variable: STR' },
            },
          ],
        },
      ],
    });

    expect(screen.getByRole('img', { name: /Undefined variable: STR/ })).toBeDefined();
    // No pool for the label, so the button falls back to the roll's name — and is disabled
    const button = screen.getByRole('button', { name: 'Roll Melee' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('should report a failed roll beside that roll rather than fatally', () => {
    renderSection({ errors: { 'mel-id': 'Undefined variable: STR' } });

    expect(screen.getByText('Undefined variable: STR')).toBeDefined();
    // The rest of the section is still there
    expect(screen.getByRole('heading', { name: 'Rolls' })).toBeDefined();
  });

  it('should head each category only when there is more than one to tell apart', () => {
    renderSection();
    expect(screen.queryByRole('heading', { name: 'offence' })).toBeNull();

    screen.getByRole('heading', { name: 'Rolls' }); // sanity: the section itself is headed

    render(
      <RollsSection
        rollGroups={[melee, { label: 'defence', rolls: [] }]}
        results={{}}
        errors={{}}
        canRoll
        onRoll={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'offence' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'defence' })).toBeDefined();
  });

  it('should say so for a ruleset that defines no rolls', () => {
    renderSection({ rollGroups: [] });

    expect(screen.getByText('This ruleset defines no rolls.')).toBeDefined();
  });

  it('should disable every roll when the character cannot be calculated', () => {
    renderSection({ canRoll: false });

    const button = screen.getByRole('button', { name: /^Roll/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  describe('with no roll handler, which is the table’s DM (TICKET-DM-05)', () => {
    /** The section as a reader who may not roll sees it */
    function renderReadOnly(results: Record<string, RollOutcome> = {}) {
      render(<RollsSection rollGroups={[melee]} results={results} errors={{}} canRoll />);
    }

    it('should draw no roll button at all — absent, not disabled', () => {
      // `canRoll` stays true: the roll is perfectly resolvable, it is just not this reader's to make,
      // and a disabled button would say *not now* where the truth is *not ever, by you*
      renderReadOnly();

      const button = screen.queryByRole('button', { name: /^Roll/ });

      expect(button).toBeNull();
    });

    it('should still show the pool that would have been thrown', () => {
      // The label was the only place the ladder appeared, so hiding the button with it would lose
      // information to remove an affordance
      renderReadOnly();

      const pool = screen.getByText('1D20 + 1D12 + 1D6 + 1');
      const input = screen.getByText('input 39');

      expect(pool).toBeDefined();
      expect(input).toBeDefined();
    });

    it('should say whose roll it is, and that the table refuses one made for them', () => {
      renderReadOnly();

      const notice = screen.getByText(/Only the Player rolls their own dice/);

      expect(notice).toBeDefined();
    });

    it('should still show what was last rolled, the log being the point of reading it', () => {
      renderReadOnly({ 'mel-id': result });

      const chain = screen.getByText('input 39 → 1D20 + 1D12 + 1D6 + 1');
      const total = screen.getByText('26');

      expect(chain).toBeDefined();
      expect(total).toBeDefined();
    });

    it('should not repeat a chip for a roll whose pool could not be derived', () => {
      // The chip above already says why there is no pool; printing nothing beside it is the honest
      // count of explanations
      render(
        <RollsSection
          rollGroups={[
            {
              label: 'offence',
              rolls: [
                {
                  id: 'mel-id',
                  name: 'Melee',
                  input: { value: null, error: 'Undefined variable: STR' },
                  notation: { text: null, error: 'Undefined variable: STR' },
                },
              ],
            },
          ]}
          results={{}}
          errors={{}}
          canRoll
        />
      );

      const chips = screen.getAllByRole('img', { name: /Undefined variable: STR/ });
      const button = screen.queryByRole('button', { name: /^Roll/ });

      expect(chips).toHaveLength(1);
      expect(button).toBeNull();
    });
  });

  it('should replay the settle animation on each new roll', () => {
    // Keyed on the timestamp, so a repeat roll remounts the breakdown rather than needing a timer
    const { container } = render(
      <RollsSection
        rollGroups={[melee]}
        results={{ 'mel-id': result }}
        errors={{}}
        canRoll
        onRoll={vi.fn()}
      />
    );

    expect(container.querySelector('.animate-roll-settle')).not.toBeNull();
  });
});
