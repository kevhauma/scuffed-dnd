/**
 * Error Chip Tests
 *
 * **Validates: Requirements 16.6, 21.2, 21.3, 22.1**
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorChip } from './ErrorChip';

describe('ErrorChip', () => {
  it('should expose the detail to assistive technology and as a tooltip', () => {
    render(<ErrorChip detail='Stat "Health": Undefined variable: NOPE' />);

    const chip = screen.getByRole('img', {
      name: 'error: Stat "Health": Undefined variable: NOPE',
    });
    expect(chip.getAttribute('title')).toBe('Stat "Health": Undefined variable: NOPE');
  });

  it('should keep the visible label in the accessible name', () => {
    // `role="img"` flattens the chip's children away, so the marker word has to be in the name
    render(<ErrorChip label="max unavailable" detail="why" />);

    expect(screen.getByRole('img', { name: 'max unavailable: why' })).toBeDefined();
  });

  it('should not take a tab stop, being a marker rather than a control', () => {
    render(<ErrorChip detail="why" />);

    // The detail travels in the accessible name instead; a focusable non-interactive element
    // would put a dead stop in the keyboard order.
    expect(screen.getByRole('img', { name: /why/ }).hasAttribute('tabindex')).toBe(false);
  });

  it('should show a default label and accept an override', () => {
    const { rerender } = render(<ErrorChip detail="why" />);
    expect(screen.getByText('error')).toBeDefined();

    rerender(<ErrorChip detail="why" label="max unavailable" />);
    expect(screen.getByText('max unavailable')).toBeDefined();
  });

  it('should render a provenance chain verbatim, so the root cause survives', () => {
    const chain =
      'Combat Skill "Melee": STL could not be calculated ← Speciality Skill "Stealth": Undefined variable: MAG';

    render(<ErrorChip detail={chain} />);

    expect(screen.getByRole('img', { name: `error: ${chain}` })).toBeDefined();
  });

  it('should append the caller className without dropping its own styling', () => {
    render(<ErrorChip detail="why" className="ml-2" />);

    const chip = screen.getByRole('img', { name: /why/ });
    expect(chip.className).toContain('ml-2');
    expect(chip.className).toContain('border-crimson');
  });
});
