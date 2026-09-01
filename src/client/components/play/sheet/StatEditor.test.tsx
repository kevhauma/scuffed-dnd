/**
 * Stat Editor Tests
 *
 * The row had no tests of its own before TICKET-DM-05 — `CharacterSheet.test.tsx` and
 * `ResourcesSection.test.tsx` drove it from above, which was right while it only rendered what it was
 * handed. It decides something now: **all three pool handlers or none**, `PurseSection`'s rule over
 * three handlers instead of two, and a component that decides alone wants a test that renders it
 * alone.
 *
 * The case that earns this file is the **partial** one. Two handlers out of three is not reachable
 * through `ResourcesSection`, which passes all three or none, but nothing in the type system stops a
 * future caller from doing it — and if the row read `onChange` alone as *editable* it would call an
 * `onAdjust` that is not there the moment somebody pressed `−`. It degrades to the reading instead.
 *
 * Pure props, so no store and no mock.
 *
 * **Validates: Concept 20; Requirements 14.1, 14.2, 14.3, 14.4, 21.1-21.5; v3 Req 42.7, 49.10**
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DerivedValue } from '../shared/derivedValue';
import { StatEditor } from './StatEditor';

/** A pool at 4 of 8 — below its maximum, so neither stepper is closed by the ceiling */
const MAX: DerivedValue = { value: 8, error: null };

/** The three handlers a Player gets, spied so a partial set can be shown not to fire */
function handlers() {
  return { onChange: vi.fn(), onAdjust: vi.fn(), onResetToMax: vi.fn() };
}

describe('StatEditor', () => {
  describe('with all three handlers, which is the Player', () => {
    it('should draw the box and all three controls', () => {
      const { onChange, onAdjust, onResetToMax } = handlers();
      render(
        <StatEditor
          name="Health"
          current={4}
          max={MAX}
          isOverMax={false}
          onChange={onChange}
          onAdjust={onAdjust}
          onResetToMax={onResetToMax}
        />
      );

      const box = screen.getByLabelText('Health');
      const decrease = screen.getByRole('button', { name: 'Decrease Health' });
      const increase = screen.getByRole('button', { name: 'Increase Health' });
      const refill = screen.getByRole('button', { name: 'Restore Health to full' });

      expect(box).toBeDefined();
      expect(decrease).toBeDefined();
      expect(increase).toBeDefined();
      expect(refill).toBeDefined();
    });

    it('should send a delta rather than doing arithmetic on the pool', () => {
      const { onChange, onAdjust, onResetToMax } = handlers();
      render(
        <StatEditor
          name="Health"
          current={4}
          max={MAX}
          isOverMax={false}
          onChange={onChange}
          onAdjust={onAdjust}
          onResetToMax={onResetToMax}
        />
      );

      const decrease = screen.getByRole('button', { name: 'Decrease Health' });
      fireEvent.click(decrease);

      expect(onAdjust).toHaveBeenCalledWith(-1);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('with no handlers, which is the table’s DM (TICKET-DM-05)', () => {
    /** The row as a reader who may not move the pool sees it */
    function renderReading(current = 4) {
      render(<StatEditor name="Health" current={current} max={MAX} isOverMax={false} />);
    }

    it('should draw where the pool stands, and what it can reach', () => {
      renderReading();

      const reading = screen.getByText('4');
      const maximum = screen.getByText('of 8 max');

      expect(reading).toBeDefined();
      expect(maximum).toBeDefined();
    });

    it('should draw no control and no entry box at all — absent, not disabled', () => {
      renderReading();

      const buttons = screen.queryAllByRole('button');
      const box = screen.queryByLabelText('Health');

      expect(buttons).toHaveLength(0);
      expect(box).toBeNull();
    });

    it('should speak the reading, a bare number beside a name not being self-describing', () => {
      // `CountRow`'s treatment of the same problem, applied here in the same change so the two
      // readings a DM meets on one sheet are spoken alike
      renderReading();

      const spoken = screen.getByText('Health stands at 4');

      expect(spoken).toBeDefined();
    });

    it('should still flag a pool stranded above a maximum that fell', () => {
      // The over-maximum flag is about the character rather than about the reader, so it survives
      // the controls going — a DM has more use for it than anyone
      render(<StatEditor name="Health" current={99} max={MAX} isOverMax />);

      const flag = screen.getByText(/Above the current maximum of 8/);

      expect(flag).toBeDefined();
    });

    it('should say the maximum is unavailable rather than chipping it a second time', () => {
      // `ResourcesSection` draws a `CountRow` above this one carrying the chip with the full
      // provenance chain, so this row says it plainly (TICKET-STAT-03) — unchanged by the reader
      const broken: DerivedValue = { value: null, error: 'Undefined variable: STR' };
      render(<StatEditor name="Health" current={4} max={broken} isOverMax={false} />);

      const stated = screen.getByText('maximum unavailable');

      expect(stated).toBeDefined();
    });
  });

  describe('with two handlers of the three, which no caller passes today', () => {
    /**
     * **The case this file exists for.** `ResourcesSection` hands over all three or none, so a
     * partial set is unreachable through the app — but nothing in the type system forbids it, and a
     * row that read `onChange` alone as *editable* would render a `−` whose `onAdjust` is not there.
     * It degrades to the reading instead of crashing on the first press.
     */
    it('should draw the reading rather than a half-wired editor', () => {
      const onChange = vi.fn();
      const onAdjust = vi.fn();
      render(
        <StatEditor
          name="Health"
          current={4}
          max={MAX}
          isOverMax={false}
          onChange={onChange}
          onAdjust={onAdjust}
        />
      );

      const buttons = screen.queryAllByRole('button');
      const box = screen.queryByLabelText('Health');
      const reading = screen.getByText('4');

      expect(buttons).toHaveLength(0);
      expect(box).toBeNull();
      expect(reading).toBeDefined();
    });

    it('should call neither handler it was given, there being nothing to press', () => {
      const onChange = vi.fn();
      const onAdjust = vi.fn();
      render(
        <StatEditor
          name="Health"
          current={4}
          max={MAX}
          isOverMax={false}
          onChange={onChange}
          onAdjust={onAdjust}
        />
      );

      expect(onChange).not.toHaveBeenCalled();
      expect(onAdjust).not.toHaveBeenCalled();
    });
  });
});
